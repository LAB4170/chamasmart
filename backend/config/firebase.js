const admin = require("firebase-admin");

const logger = require("../utils/logger");

// Validate required environment variables

const requiredEnvVars = [
  "FIREBASE_PROJECT_ID",

  "FIREBASE_CLIENT_EMAIL",

  "FIREBASE_PRIVATE_KEY",
];

// Check for missing environment variables

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  const errorMessage = `Missing required Firebase environment variables: ${missingVars.join(", ")}`;

  logger.error(errorMessage);

  throw new Error(errorMessage);
}

try {
  // Initialize Firebase Admin with environment variables

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,

      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  logger.info("Firebase Admin successfully initialized");
} catch (error) {
  const errorMessage = `Failed to initialize Firebase Admin: ${error.message}`;

  logger.error(errorMessage, { error });

  throw new Error(errorMessage); // Fail fast if Firebase initialization fails
}

// Export the initialized admin instance

module.exports = admin;
