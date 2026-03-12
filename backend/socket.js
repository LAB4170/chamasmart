const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { socketCorsOptions } = require('./config/cors');
const logger = require('./utils/logger');
const { metrics } = require('./middleware/metrics');

let io;
let pubClient;
let subClient;

module.exports = {
  init: async httpServer => {
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
          // Use url instead of host/port for newer redis client if needed, 
          // but sticking to standard config if it works.
          socket: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
          password: process.env.REDIS_PASSWORD,
        });

        pubClient.on('error', (err) => {
          logger.error('Redis Pub Client Error:', err.message);
        });

        subClient = pubClient.duplicate();
        subClient.on('error', (err) => {
          logger.error('Redis Sub Client Error:', err.message);
        });

        await Promise.all([
          pubClient.connect(),
          subClient.connect(),
        ]);

        io.adapter(createAdapter(pubClient, subClient));

        logger.info('Socket.io Redis adapter initialized', {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT,
        });
      } catch (error) {
        logger.error('Failed to initialize Redis adapter, using in-memory adapter', {
          error: error.message,
        });
      }
    } else {
      logger.warn('Redis not configured, Socket.io will use in-memory adapter (single server only)');
    }

    // JWT Authentication Middleware for Socket.io (OPTIONAL - allows connection without auth)
    io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

      if (!token) {
        logger.warn('Socket connection without token - allowing but marking as unauthenticated', {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        socket.userId = null; // Mark as unauthenticated
        socket.userEmail = null;
        return next(); // Allow connection
      }

      try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        socket.userId = decoded.sub || decoded.user_id || decoded.id;
        socket.userEmail = decoded.email;

        logger.debug('Socket authenticated', {
          socketId: socket.id,
          userId: decoded.user_id,
        });

        next();
      } catch (err) {
        logger.warn('Socket authentication failed - allowing connection but marking as unauthenticated', {
          socketId: socket.id,
          error: err.message,
        });
        socket.userId = null; // Mark as unauthenticated
        socket.userEmail = null;
        next(); // Allow connection even with invalid/expired token
      }
    });

    logger.info('WebSocket initialized with JWT security and CORS protection');

    io.on('connection_error', (err) => {
      logger.error('Socket connection error:', err);
    });

    const activeUsers = new Set();

    io.on('connection', socket => {
      logger.info('Client attempting to connect...', { socketId: socket.id });
      const { userId } = socket;

      // Update metrics
      if (metrics?.socketConnections) {
        metrics.socketConnections.inc();
      }

      logger.debug('New client connected', {
        socketId: socket.id,
        userId: userId || 'unauthenticated',
        authenticated: !!userId
      });

      // Only join user room if authenticated
      if (userId) {
        socket.join(`user_${userId}`);
        activeUsers.add(userId);
        io.emit('presence_update', Array.from(activeUsers));
        logger.debug('User joined personal room', {
          userId,
          activeUsersCount: activeUsers.size,
        });
      }

      // Join chama room
      socket.on('join_chama', chamaId => {
        socket.join(`chama_${chamaId}`);
        logger.debug('Client joined chama group', {
          socketId: socket.id,
          chamaId,
        });

        // Notify others in the chama
        socket.to(`chama_${chamaId}`).emit('user_joined', {
          userId,
          timestamp: new Date().toISOString(),
        });
      });

      // Leave chama room
      socket.on('leave_chama', chamaId => {
        socket.leave(`chama_${chamaId}`);
        logger.debug('Client left chama group', {
          socketId: socket.id,
          chamaId,
        });

        // Notify others in the chama
        socket.to(`chama_${chamaId}`).emit('user_left', {
          userId,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle typing indicators
      socket.on('typing', ({ chamaId, isTyping }) => {
        socket.to(`chama_${chamaId}`).emit('user_typing', {
          userId,
          isTyping,
        });
      });

      // --- Chat Messaging Events ---
      socket.on('join_chat_channel', channelId => {
        socket.join(`chat_${channelId}`);
        logger.debug('Client joined chat channel', { socketId: socket.id, channelId });
      });

      socket.on('leave_chat_channel', channelId => {
        socket.leave(`chat_${channelId}`);
        logger.debug('Client left chat channel', { socketId: socket.id, channelId });
      });

      socket.on('send_chat_message', async (data) => {
        if (!userId) return; // Must be authenticated
        try {
          const pool = require('./config/db'); // lazy load
          const { channelId, messageType, content, mediaUrl } = data;
          
          const result = await pool.query(
            `INSERT INTO chat_messages (channel_id, user_id, message_type, content, media_url) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
             [channelId, userId, messageType, content, mediaUrl]
          );
          
          const userRes = await pool.query("SELECT first_name, last_name, profile_picture_url FROM users WHERE user_id = $1", [userId]);
          const userData = userRes.rows[0];

          const broadcastData = {
            ...result.rows[0],
            first_name: userData?.first_name,
            last_name: userData?.last_name,
            profile_picture_url: userData?.profile_picture_url
          };

          io.to(`chat_${channelId}`).emit('new_message', broadcastData);
        } catch (error) {
          logger.error('Socket chat message error', { error: error.message });
        }
      });
      // -----------------------------

      // Handle disconnect
      socket.on('disconnect', () => {
        // Update metrics
        if (metrics?.socketConnections) {
          metrics.socketConnections.dec();
        }

        logger.debug('Client disconnected', { socketId: socket.id });

        if (userId) {
          activeUsers.delete(userId);
          io.emit('presence_update', Array.from(activeUsers));
          logger.debug('User disconnected', {
            userId,
            activeUsersCount: activeUsers.size,
          });
        }
      });

      // Handle errors
      socket.on('error', error => {
        logger.error('Socket error', {
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
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },

  // Graceful shutdown
  close: async () => {
    if (io) {
      io.close();
      logger.info('Socket.io server closed');
    }

    if (pubClient) {
      await pubClient.quit();
      logger.info('Socket.io Redis pub client closed');
    }

    if (subClient) {
      await subClient.quit();
      logger.info('Socket.io Redis sub client closed');
    }
  },
};
