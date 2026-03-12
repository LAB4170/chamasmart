const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  searchUser,
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
  uploadProfilePicture,
} = require('../controllers/userController');
const { applyRateLimiting } = require('../middleware/rateLimiting');
const validate = require('../middleware/validate');
const { single } = require('../middleware/upload');
const {
  updateProfileSchema,
  changePasswordSchema,
} = require('../utils/validationSchemas');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

// Get current user profile
router.get('/profile', getProfile);

// Update user profile
router.put(
  '/profile',
  applyRateLimiting,
  validate(updateProfileSchema),
  updateProfile,
);

// Change password
router.put(
  '/change-password',
  applyRateLimiting,
  validate(changePasswordSchema),
  changePassword,
);

// Deactivate account
router.delete('/account', applyRateLimiting, deactivateAccount);

// ============================================================================
// USER SEARCH
// ============================================================================

// Search for users (with rate limiting)
router.get('/search', applyRateLimiting, searchUser);

// Upload profile picture via backend proxy (bypasses CORS)
router.post('/profile-picture', single('image'), uploadProfilePicture);

// Image proxy — fetches an image at a given URL server-side and streams it to the browser
// This bypasses Firebase Storage CORS restrictions on localhost
router.get('/image-proxy', protect, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: 'url query param required' });

    const https = require('https');
    const http = require('http');
    const client = url.startsWith('https') ? https : http;

    client.get(url, (imgRes) => {
      res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      imgRes.pipe(res);
    }).on('error', (err) => {
      console.error('Image proxy error:', err.message);
      res.status(502).json({ message: 'Failed to fetch image' });
    });
  } catch (err) {
    console.error('Image proxy error:', err);
    res.status(500).json({ message: 'Internal error' });
  }
});

module.exports = router;
