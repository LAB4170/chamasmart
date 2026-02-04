const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { inspect } = require("util");

// Create logs directory if it doesn't exist
const fs = require("fs");

const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Environment detection
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

// Custom format for console output (development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add stack trace if exists
    if (stack) {
      msg += `\n${stack}`;
    }

    // Handle meta data
    if (Object.keys(meta).length > 0) {
      // Handle circular references in meta
      const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          return value;
        };
      };

      // Format meta for better readability
      msg += `\n${inspect(meta, {
        depth: null,
        colors: true,
        compact: false,
        getCircularReplacer,
      })}`;
    }

    return msg;
  }),
);

// JSON format for file/production output
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json({
    space: isDevelopment ? 2 : 0,
    replacer: (key, value) => {
      // Handle circular references
      if (value === null || value === undefined) return value;
      if (
        key === "password" ||
        key.endsWith("Password") ||
        key.endsWith("_password")
      ) {
        return "***REDACTED***";
      }
      if (value instanceof Error) {
        return {
          message: value.message,
          name: value.name,
          stack: value.stack,
          ...value,
        };
      }
      return value;
    },
  }),
);

// Create logger instance with enhanced configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: isProduction ? jsonFormat : consoleFormat,
  defaultMeta: {
    service: "chamasmart-api",
    environment: process.env.NODE_ENV || "development",
    node_version: process.version,
  },
  exitOnError: false, // Don't exit on handled exceptions
  transports: [],
});

// Add console transport for non-test environments
if (!isTest) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    }),
  );
}

// File transports for production
if (isProduction) {
  // Error log file with rotation
  logger.add(
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "50m",
      maxFiles: "14d",
      zippedArchive: true,
      format: jsonFormat,
    }),
  );

  // Combined log file with rotation
  logger.add(
    new DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "50m",
      maxFiles: "14d",
      zippedArchive: true,
      format: jsonFormat,
    }),
  );
}

// Request ID middleware
const requestId = (req, res, next) => {
  req.id = req.headers["x-request-id"] || uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = process.hrtime();
  const childLogger = logger.child({
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
    userId: req.user?.id || "anonymous",
  });

  // Add logger to request object
  req.logger = childLogger;

  // Log response when finished
  res.on("finish", () => {
    const durationInMs = process.hrtime(start)[1] / 1000000;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationInMs.toFixed(2)}ms`;

    const logData = {
      statusCode: res.statusCode,
      responseTime: durationInMs,
      contentLength: res.get("content-length") || 0,
      referrer: req.get("referer") || "",
      userId: req.user?.id || "anonymous",
      userAgent: req.get("user-agent"),
    };

    if (res.statusCode >= 500) {
      childLogger.error(message, logData);
    } else if (res.statusCode >= 400) {
      childLogger.warn(message, logData);
    } else if (process.env.LOG_LEVEL === "debug") {
      childLogger.debug(message, logData);
    }
  });

  next();
};

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  // In production, you might want to gracefully shut down the server here
  if (isProduction) {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
  // In production, you might want to gracefully shut down the server here
  if (isProduction) {
    process.exit(1);
  }
});

// Helper methods for common logging patterns
const logRequest = (req, message, meta = {}) => {
  const loggerInstance = req.logger || logger;
  loggerInstance.info(message, {
    ...meta,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id || "anonymous",
  });
};

const logError = (error, context = {}) => {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
  };

  if (error.code) errorInfo.code = error.code;
  if (error.statusCode) errorInfo.statusCode = error.statusCode;

  logger.error(error.message, errorInfo);
};

const logDatabaseQuery = (query, duration, context = {}) => {
  logger.debug("Database Query", {
    ...context,
    query: typeof query === "string" ? query.trim() : query,
    duration: `${duration}ms`,
    type: "database",
  });
};

const logSecurityEvent = (event, details = {}) => {
  logger.warn(`Security Event: ${event}`, {
    ...details,
    type: "security",
    timestamp: new Date().toISOString(),
  });
};

// Create a stream for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    // Parse the message to extract relevant parts
    const logMatch = message.match(
      /(\S+) (\S+) (\S+) \[([\w:/]+\s[+\-]\d{4})\] "(\S+)\s?(\S+)?\s?(\S+)?" (\d{3}) (\d+) "(.*?)" "(.*?)" "(.*?)" (\d+\.?\d*)/,
    );

    if (logMatch) {
      const [
        ,
        remoteAddr,
        remoteUser,
        httpUser,
        time,
        method,
        url,
        protocol,
        status,
        bytes,
        referrer,
        userAgent,
        forwardedFor,
        responseTime,
      ] = logMatch;

      logger.http("HTTP Request", {
        remoteAddr,
        remoteUser,
        httpUser,
        time: new Date(time),
        method,
        url,
        protocol,
        status: parseInt(status, 10),
        bytes: parseInt(bytes, 10),
        referrer,
        userAgent,
        forwardedFor,
        responseTime: parseFloat(responseTime),
      });
    } else {
      logger.info(message.trim());
    }
  },
};

// Handle uncaught exceptions and rejections in production
if (isProduction) {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    // Consider whether to exit in production
    // process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", { promise, reason });
    // Consider whether to exit in production
    // process.exit(1);
  });
}

// Export the logger with all its methods
module.exports = Object.assign(logger, {
  requestId,
  requestLogger,
  logRequest,
  logError,
  logDatabaseQuery,
  logSecurityEvent,
  stream: logger.stream,
});
