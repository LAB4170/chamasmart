const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require('../utils/auditLog');
const { uploadToStorage } = require('../utils/storage');
const cacheManager = require('../config/cache');

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const cacheKey = `user_profile_v1:${userId}`;
    const user = await cacheManager.getOrSet(cacheKey, async () => {
      const result = await pool.query(
        `SELECT user_id, first_name, last_name, email, phone_number, national_id, profile_picture_url,
                      role, is_active, email_verified, phone_verified, 
                      created_at, updated_at
               FROM users 
               WHERE user_id = $1`,
        [userId],
      );
      if (result.rows.length === 0) return null;
      return result.rows[0];
    }, 600); // Cache for 10 minutes

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await logAuditEvent({
      eventType: EVENT_TYPES.USER_PROFILE_VIEWED,
      userId,
      action: 'Viewed user profile',
      entityType: 'user',
      entityId: userId,
      severity: SEVERITY.LOW,
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user profile',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    console.log("RECEIVED UPDATE BODY:", req.body);
    const userId = req.user.id;
    const { firstName, lastName, email, phoneNumber, nationalId, profilePictureUrl } = req.body;

    // Validate input
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required',
      });
    }

    const result = await pool.query(
      `UPDATE users 
             SET first_name = $1, last_name = $2, email = COALESCE(NULLIF($3, ''), email), phone_number = $4, national_id = $5, profile_picture_url = $6, updated_at = NOW()
             WHERE user_id = $7
             RETURNING user_id, first_name, last_name, email, phone_number, national_id, profile_picture_url as "profilePictureUrl", updated_at`,
      [firstName, lastName, email || null, phoneNumber, nationalId, profilePictureUrl || null, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await logAuditEvent({
      eventType: EVENT_TYPES.USER_PROFILE_UPDATED,
      userId,
      action: 'Updated user profile',
      entityType: 'user',
      entityId: userId,
      metadata: { firstName, lastName, email, phoneNumber },
      severity: SEVERITY.MEDIUM,
    });

    await cacheManager.del(`user_profile_v1:${userId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle specific database errors (like unique constraint violations)
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Phone number or email is already in use by another account',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user profile',
    });
  }
};

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    // Get current user with password
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash,
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [newPasswordHash, userId],
    );

    await logAuditEvent({
      eventType: EVENT_TYPES.USER_PASSWORD_CHANGED,
      userId,
      action: 'Changed user password',
      entityType: 'user',
      entityId: userId,
      severity: SEVERITY.HIGH,
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
    });
  }
};

// @desc    Deactivate user account
// @route   DELETE /api/users/account
// @access  Private
const deactivateAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE user_id = $1',
      [userId],
    );

    await logAuditEvent({
      eventType: EVENT_TYPES.USER_ACCOUNT_DEACTIVATED,
      userId,
      action: 'Deactivated user account',
      entityType: 'user',
      entityId: userId,
      severity: SEVERITY.HIGH,
    });

    res.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating account',
    });
  }
};

// @desc    Search for a user by email or phone
// @route   GET /api/users/search
// @access  Private
const searchUser = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query (email or phone)',
      });
    }

    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, phone_number 
       FROM users 
       WHERE (email = $1 OR phone_number = $1) AND is_active = true`,
      [query],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];

    await logAuditEvent({
      eventType: EVENT_TYPES.USER_SEARCHED,
      userId: req.user.id,
      action: 'Searched for user',
      entityType: 'user',
      entityId: user.user_id,
      metadata: { searchQuery: query },
      severity: SEVERITY.LOW,
    });

    res.json({
      success: true,
      data: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
      },
    });
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching for user',
    });
  }
};

// @desc    Upload profile picture
// @route   POST /api/users/profile-picture
// @access  Private
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const uploadedFile = req.file || (req.files && req.files[0]) || (req.uploadedFiles && req.uploadedFiles[0]);

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Upload to storage (GCS or Local Fallback)
    const profilePictureUrl = await uploadToStorage(uploadedFile, `avatars/${userId}`);

    // Log the event
    await logAuditEvent({
      eventType: EVENT_TYPES.USER_PROFILE_UPDATED,
      userId,
      action: 'Uploaded profile picture',
      entityType: 'user',
      entityId: userId,
      severity: SEVERITY.MEDIUM,
    });

    await cacheManager.del(`user_profile_v1:${userId}`);

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: { profilePictureUrl },
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile picture',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
  searchUser,
  uploadProfilePicture,
};
