const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const { socketCorsOptions } = require("./config/cors");
const logger = require("./utils/logger");

let io;

module.exports = {
    init: (httpServer) => {
        io = socketIo(httpServer, {
            cors: socketCorsOptions,
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        // JWT Authentication Middleware for Socket.io
        io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.token;

            if (!token) {
                return next(new Error("Authentication error: Token missing"));
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id; // Corrected from decoded.user_id if common with protect middleware
                next();
            } catch (err) {
                return next(new Error("Authentication error: Invalid token"));
            }
        });

        logger.info("WebSocket initialized with JWT security and CORS protection");

        const activeUsers = new Set();

        io.on("connection", (socket) => {
            const userId = socket.userId;
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

            // Basic authentication could be added here via middleware

            socket.on("join_chama", (chamaId) => {
                socket.join(`chama_${chamaId}`);
                logger.debug(`Client joined chama group`, {
                    socketId: socket.id,
                    chamaId
                });
            });

            socket.on("leave_chama", (chamaId) => {
                socket.leave(`chama_${chamaId}`);
                logger.debug(`Client left chama group`, {
                    socketId: socket.id,
                    chamaId
                });
            });

            socket.on("disconnect", () => {
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
        });

        return io;
    },
    getIo: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    }
};
