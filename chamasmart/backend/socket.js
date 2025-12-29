const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { socketCorsOptions } = require("./config/cors");
const logger = require("./utils/logger");
const { metrics } = require("./middleware/metrics");

let io;
let pubClient;
let subClient;

module.exports = {
    init: async (httpServer) => {
        io = socketIo(httpServer, {
            cors: socketCorsOptions,
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            maxHttpBufferSize: 1e6, // 1MB
            allowEIO3: true,
        });

        // Set up Redis adapter for horizontal scaling
        if (process.env.REDIS_HOST) {
            try {
                pubClient = createClient({
                    host: process.env.REDIS_HOST,
                    port: parseInt(process.env.REDIS_PORT) || 6379,
                    password: process.env.REDIS_PASSWORD,
                });

                subClient = pubClient.duplicate();

                await Promise.all([
                    pubClient.connect(),
                    subClient.connect()
                ]);

                io.adapter(createAdapter(pubClient, subClient));

                logger.info("Socket.io Redis adapter initialized", {
                    host: process.env.REDIS_HOST,
                    port: process.env.REDIS_PORT,
                });
            } catch (error) {
                logger.error("Failed to initialize Redis adapter, using in-memory adapter", {
                    error: error.message,
                });
            }
        } else {
            logger.warn("Redis not configured, Socket.io will use in-memory adapter (single server only)");
        }

        // JWT Authentication Middleware for Socket.io
        io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

            if (!token) {
                logger.warn("Socket connection without token", {
                    socketId: socket.id,
                    ip: socket.handshake.address,
                });
                return next();
            }

            try {
                const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
                socket.userId = decoded.user_id;
                socket.userEmail = decoded.email;

                logger.debug("Socket authenticated", {
                    socketId: socket.id,
                    userId: decoded.user_id,
                });

                next();
            } catch (err) {
                logger.error("Socket authentication failed", {
                    socketId: socket.id,
                    error: err.message,
                });
                next(new Error("Authentication error"));
            }
        });

        logger.info("WebSocket initialized with JWT security and CORS protection");

        const activeUsers = new Set();

        io.on("connection", (socket) => {
            const userId = socket.userId;

            // Update metrics
            if (metrics?.socketConnections) {
                metrics.socketConnections.inc();
            }

            logger.debug(`New client connected`, { socketId: socket.id, userId });

            if (userId) {
                socket.join(`user_${userId}`);
                activeUsers.add(userId);
                io.emit("presence_update", Array.from(activeUsers));
                logger.debug(`User joined personal room`, {
                    userId,
                    activeUsersCount: activeUsers.size
                });
            }

            // Join chama room
            socket.on("join_chama", (chamaId) => {
                socket.join(`chama_${chamaId}`);
                logger.debug(`Client joined chama group`, {
                    socketId: socket.id,
                    chamaId
                });

                // Notify others in the chama
                socket.to(`chama_${chamaId}`).emit("user_joined", {
                    userId,
                    timestamp: new Date().toISOString(),
                });
            });

            // Leave chama room
            socket.on("leave_chama", (chamaId) => {
                socket.leave(`chama_${chamaId}`);
                logger.debug(`Client left chama group`, {
                    socketId: socket.id,
                    chamaId
                });

                // Notify others in the chama
                socket.to(`chama_${chamaId}`).emit("user_left", {
                    userId,
                    timestamp: new Date().toISOString(),
                });
            });

            // Handle typing indicators
            socket.on("typing", ({ chamaId, isTyping }) => {
                socket.to(`chama_${chamaId}`).emit("user_typing", {
                    userId,
                    isTyping,
                });
            });

            // Handle disconnect
            socket.on("disconnect", () => {
                // Update metrics
                if (metrics?.socketConnections) {
                    metrics.socketConnections.dec();
                }

                logger.debug(`Client disconnected`, { socketId: socket.id });

                if (userId) {
                    activeUsers.delete(userId);
                    io.emit("presence_update", Array.from(activeUsers));
                    logger.debug(`User disconnected`, {
                        userId,
                        activeUsersCount: activeUsers.size
                    });
                }
            });

            // Handle errors
            socket.on("error", (error) => {
                logger.error("Socket error", {
                    socketId: socket.id,
                    userId,
                    error: error.message,
                });
            });
        });

        return io;
    },

    getIo: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },

    // Graceful shutdown
    close: async () => {
        if (io) {
            io.close();
            logger.info("Socket.io server closed");
        }

        if (pubClient) {
            await pubClient.quit();
            logger.info("Socket.io Redis pub client closed");
        }

        if (subClient) {
            await subClient.quit();
            logger.info("Socket.io Redis sub client closed");
        }
    }
};
