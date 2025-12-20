const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

module.exports = {
    init: (httpServer) => {
        io = socketIo(httpServer, {
            cors: {
                origin: "*", // Adjust for production
                methods: ["GET", "POST"]
            }
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

        console.log("WebSocket initialized with JWT security");

        const activeUsers = new Set();

        io.on("connection", (socket) => {
            const userId = socket.userId;
            console.log(`New client connected: ${socket.id} (User: ${userId})`);

            if (userId) {
                socket.join(`user_${userId}`);
                activeUsers.add(userId);
                io.emit("presence_update", Array.from(activeUsers));
                console.log(`User ${userId} joined their personal room. Active: ${activeUsers.size}`);
            }

            // Basic authentication could be added here via middleware

            socket.on("join_chama", (chamaId) => {
                socket.join(`chama_${chamaId}`);
                console.log(`Client ${socket.id} joined chama group: ${chamaId}`);
            });

            socket.on("leave_chama", (chamaId) => {
                socket.leave(`chama_${chamaId}`);
                console.log(`Client ${socket.id} left chama group: ${chamaId}`);
            });

            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
                if (userId) {
                    activeUsers.delete(userId);
                    io.emit("presence_update", Array.from(activeUsers));
                    console.log(`User ${userId} disconnected. Active: ${activeUsers.size}`);
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
