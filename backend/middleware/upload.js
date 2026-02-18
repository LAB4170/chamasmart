const multer = require('multer');
const path = require('path');
const logger = require('../utils/logger');

// Configure storage
const storage = multer.memoryStorage();

// File filter to allow only certain file types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'application/pdf', // PDF documents
    'image/jpeg', // JPEG images
    'image/png', // PNG images
    'image/jpg', // JPG images
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      'Invalid file type. Only PDF, JPG, PNG, and DOC/DOCX files are allowed.',
    );
    error.code = 'LIMIT_FILE_TYPES';
    cb(error, false);
  }
};

// Configure multer with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // Maximum 5 files per upload
  },
});

// Middleware to handle file uploads with error handling
const handleUpload = (fieldName, maxCount = 1) => {
  const uploadHandler = upload.array(fieldName, maxCount);

  return (req, res, next) => {
    uploadHandler(req, res, err => {
      if (err) {
        logger.error('File upload error:', { error: err.message });

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'File too large. Maximum file size is 10MB.',
          });
        }

        if (err.code === 'LIMIT_FILE_TYPES') {
          return res.status(415).json({
            success: false,
            message:
              'Invalid file type. Only PDF, JPG, PNG, and DOC/DOCX files are allowed.',
          });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Maximum ${maxCount} file(s) allowed per upload.`,
          });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: `Unexpected field. Make sure the field name is '${fieldName}'.`,
          });
        }

        // Handle other multer errors
        return res.status(400).json({
          success: false,
          message: 'Error uploading file. Please try again.',
        });
      }

      // Check if files were uploaded (if required)
      if (req.files && req.files.length > 0) {
        // Add file metadata to request object for controller to access
        req.uploadedFiles = req.files.map(file => ({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
          extension: path.extname(file.originalname).toLowerCase(),
        }));
      }

      next();
    });
  };
};

// Single file upload middleware
const singleUpload = fieldName => handleUpload(fieldName, 1);

// Multiple files upload middleware
const multipleUpload = (fieldName, maxCount = 5) => handleUpload(fieldName, maxCount);

module.exports = {
  single: singleUpload,
  multiple: multipleUpload,
  upload, // Direct multer instance for advanced usage
};
