const { Storage } = require('@google-cloud/storage');
const path = require('path');
const logger = require('./logger');
const fs = require('fs').promises;

// Initialize Google Cloud Storage
let storage;
let bucket;
const bucketName = process.env.GCS_BUCKET_NAME || 'chamasmart-welfare-docs';

try {
  storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GCP_PROJECT_ID,
  });
  bucket = storage.bucket(bucketName);
} catch (err) {
  logger.warn('Failed to initialize Google Cloud Storage:', err.message);
  // Mock storage for dev environment if crucial env vars are missing
  bucket = {
    file: () => ({
      createWriteStream: () => ({
        on: (event, cb) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('GCS not configured')), 10);
          }
        },
        end: () => {},
      }),
      delete: async () => true,
    }),
  };
}

/**
 * Uploads a file to Google Cloud Storage
 * @param {Object} file - Multer file object
 * @param {string} destinationPath - Path within the bucket (e.g., 'welfare/chama-123/claims')
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
const uploadToStorage = async (file, destinationPath) => {
  // If GCS is not configured (mocked bucket), fallback to local storage
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.GCS_BUCKET_NAME) {
    try {
      const uploadDir = path.join(__dirname, '../uploads', destinationPath);
      const fs = require('fs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      const localFilePath = path.join(uploadDir, filename);
      
      fs.writeFileSync(localFilePath, file.buffer);
      
      const publicUrl = `/uploads/${destinationPath}/${filename}`.replace(/\\/g, '/');
      logger.info(`File stored locally (GCS not configured): ${publicUrl}`);
      return publicUrl;
    } catch (localError) {
      logger.error('Error in local storage fallback:', localError);
      throw localError;
    }
  }

  try {
    // Generate a unique filename
    const extension = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${extension}`;
    const destination = `${destinationPath}/${filename}`;

    // Upload the file
    const blob = bucket.file(destination);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Return a promise that resolves when the upload is complete
    return new Promise((resolve, reject) => {
      blobStream.on('error', error => {
        logger.error('Error uploading to storage:', error);
        reject(error);
      });

      blobStream.on('finish', () => {
        // Make the file public (optional)
        blob
          .makePublic()
          .then(() => {
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
            resolve(publicUrl);
          })
          .catch(error => {
            logger.error('Error making file public:', error);
            reject(error);
          });
      });

      // Write the file to GCS
      blobStream.end(file.buffer);
    });
  } catch (error) {
    logger.error('Error in uploadToStorage:', error);
    throw error;
  }
};

/**
 * Deletes a file from Google Cloud Storage
 * @param {string} fileUrl - The public URL of the file to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
const deleteFromStorage = async fileUrl => {
  try {
    // Extract the file path from the URL
    const filePath = fileUrl.replace(
      `https://storage.googleapis.com/${bucketName}/`,
      '',
    );

    await bucket.file(filePath).delete();
    return true;
  } catch (error) {
    // Don't fail if the file doesn't exist
    if (error.code === 404) {
      return true;
    }

    logger.error('Error deleting file from storage:', error);
    throw error;
  }
};

module.exports = {
  uploadToStorage,
  deleteFromStorage,
  bucket,
};
