/**
 * FAST-TRACK INTEGRATION: Encryption in authController
 * File: backend/controllers/authController.js
 *
 * STEP 1: Add this import at the TOP of the file
 */

const {
  encryptSensitiveData,
  decryptSensitiveData,
} = require("../security/encryption");

/**
 * STEP 2: In the register() function
 *
 * FIND THIS SECTION (around line 215):
 */
const oldRegisterInsert = `
    // Create user
    const result = await pool.query(
      \`INSERT INTO users (email, password_hash, first_name, last_name, phone_number, national_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, first_name, last_name, phone_number, created_at\`,
      [
        email.toLowerCase(),
        hashedPassword,
        firstName,
        lastName,
        normalizedPhone,
        nationalId || null,
      ]
    );
`;

/**
 * REPLACE WITH THIS (adds encryption before INSERT):
 */
const newRegisterInsert = `
    // Encrypt sensitive PII before storage
    const encryptedEmail = encryptSensitiveData(email.toLowerCase());
    const encryptedPhone = encryptSensitiveData(normalizedPhone);
    const encryptedNationalId = nationalId ? encryptSensitiveData(nationalId) : null;

    // Create user with encrypted PII
    const result = await pool.query(
      \`INSERT INTO users (email, password_hash, first_name, last_name, phone_number, national_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, first_name, last_name, phone_number, created_at\`,
      [
        encryptedEmail,
        hashedPassword,
        firstName,
        lastName,
        encryptedPhone,
        encryptedNationalId,
      ]
    );
`;

/**
 * STEP 3: In the getMe() function (or any function that SELECT * from users)
 *
 * FIND THIS SECTION:
 */
const oldGetMe = `
    const result = await pool.query(
      'SELECT user_id, email, first_name, last_name, phone_number FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    const user = result.rows[0];
    res.status(200).json({
      success: true,
      data: { user },
    });
`;

/**
 * REPLACE WITH THIS (decrypts after retrieval):
 */
const newGetMe = `
    const result = await pool.query(
      'SELECT user_id, email, first_name, last_name, phone_number, national_id FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];
    
    // Decrypt sensitive PII for response
    try {
      user.email = decryptSensitiveData(user.email);
      user.phone_number = decryptSensitiveData(user.phone_number);
      if (user.national_id) {
        user.national_id = decryptSensitiveData(user.national_id);
      }
    } catch (err) {
      logger.error('Error decrypting user data', { context: 'getMe_decrypt', error: err.message });
      // Return without PII if decryption fails
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
`;

/**
 * STEP 4: Apply same pattern to all functions that SELECT users:
 * - login()
 * - verifyEmail()
 * - verifyPhone()
 * - And any controller that returns user data
 *
 * PATTERN:
 * 1. After SELECT - decrypt the fields
 * 2. Before INSERT/UPDATE - encrypt the fields
 *
 * Example for login():
 */
const loginExample = `
    // In login() - after successful credential check
    const user = result.rows[0];
    
    // Decrypt for comparison/response (if needed)
    // user.email = decryptSensitiveData(user.email);
    // user.phone_number = decryptSensitiveData(user.phone_number);
    
    // Generate tokens
    const token = generateAccessToken(user.user_id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.user_id,
          email: user.email, // This is encrypted in DB but returned encrypted to client
          // Client-side must decrypt if needed
        },
        token,
      },
    });
`;

/**
 * IMPORTANT NOTES:
 *
 * 1. Database stores ENCRYPTED values:
 *    - email: 'eyJhbGc...' (encrypted)
 *    - phone_number: 'eyJhbGc...' (encrypted)
 *    - national_id: 'eyJhbGc...' (encrypted)
 *
 * 2. Application decrypts when needed:
 *    - For displaying to user
 *    - For comparisons
 *    - For email sending
 *
 * 3. Search queries DON'T work on encrypted fields:
 *    OLD: SELECT * FROM users WHERE email = $1 ✅ WORKS
 *    NEW: SELECT * FROM users WHERE email = encryptedEmail ❌ FAILS
 *
 *    FIX: For login, you must:
 *    - Get ALL users
 *    - Decrypt each email
 *    - Compare in code
 *
 *    OR: Store email hash separately for searching
 *
 * 4. Migration needed for existing users:
 *    ALTER TABLE users ADD COLUMN email_encrypted TEXT;
 *    ALTER TABLE users ADD COLUMN phone_encrypted TEXT;
 *    -- Encrypt all existing data
 *    -- Then drop old columns
 */
