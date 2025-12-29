const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// JSON format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    defaultMeta: {
        service: 'chamasmart-api',
        environment: process.env.NODE_ENV || 'development',
    },
    transports: [
        // Error log file with rotation
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        }),

        // Combined log file with rotation
        new DailyRotateFile({
            filename: path.join(logsDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        }),
    ],

    // Handle exceptions and rejections
    exceptionHandlers: [
        new DailyRotateFile({
            filename: path.join(logsDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],

    rejectionHandlers: [
        new DailyRotateFile({
            filename: path.join(logsDir, 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],
});

// Add console transport in development or if explicitly enabled
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOGS === 'true') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
    }));
}

// Helper methods for common logging patterns
logger.logRequest = (req, message, meta = {}) => {
    logger.info(message, {
        method: req.method,
        url: req.url,
        userId: req.user?.user_id,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        ...meta,
    });
};

logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        stack: error.stack,
        name: error.name,
        ...context,
    });
};

logger.logDatabaseQuery = (query, duration, context = {}) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    logger.log(level, 'Database query executed', {
        query: query.substring(0, 200), // Truncate long queries
        duration: `${duration}ms`,
        ...context,
    });
};

logger.logSecurityEvent = (event, details = {}) => {
    logger.warn(`Security Event: ${event}`, {
        event,
        timestamp: new Date().toISOString(),
        ...details,
    });
};

// Create a stream for Morgan HTTP logger
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};

module.exports = logger;
