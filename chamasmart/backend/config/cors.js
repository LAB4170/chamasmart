const logger = require('../utils/logger');

// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
    const envOrigins = process.env.ALLOWED_ORIGINS;

    if (envOrigins) {
        return envOrigins.split(',').map(origin => origin.trim());
    }

    // Default origins for development
    if (process.env.NODE_ENV !== 'production') {
        return [
            'http://localhost:5173',
            'http://localhost:5000',
            'http://localhost:3000',
        ];
    }

    // Production should always have ALLOWED_ORIGINS set
    logger.warn('ALLOWED_ORIGINS not set in production environment');
    return [];
};

const allowedOrigins = getAllowedOrigins();

// CORS configuration for Express
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.logSecurityEvent('CORS_VIOLATION', {
                origin,
                allowedOrigins,
            });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours
};

// Socket.io CORS configuration
const socketCorsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.logSecurityEvent('SOCKET_CORS_VIOLATION', {
                origin,
                allowedOrigins,
            });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST'],
};

module.exports = {
    corsOptions,
    socketCorsOptions,
    allowedOrigins,
};
