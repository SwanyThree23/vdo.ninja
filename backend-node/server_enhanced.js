const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { logger, requestLogger } = require('./middleware/logger');
const { limiter } = require('./middleware/rateLimit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Make io accessible to routes
app.set('io', io);

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const streamRoutes = require('./routes/streams');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const automationRoutes = require('./routes/automation');
const analyticsRoutes = require('./routes/analytics');
const { router: webhookRoutes } = require('./routes/webhooks');

// API Routes with rate limiting
app.use('/api/auth', limiter.auth, authRoutes);
app.use('/api/chat', limiter.chat, chatRoutes);
app.use('/api/streams', limiter.general, streamRoutes);
app.use('/api/payments', limiter.general, paymentRoutes);
app.use('/api/users', limiter.general, userRoutes);
app.use('/api/teams', limiter.general, teamRoutes);
app.use('/api/automation', limiter.generation, automationRoutes);
app.use('/api/analytics', limiter.general, analyticsRoutes);
app.use('/api/webhooks', limiter.general, webhookRoutes);

// Health check (no rate limit)
app.get('/api/health', async (req, res) => {
  try {
    const db = require('./db');
    
    // Check database
    await db.query('SELECT 1');
    
    // Check Redis
    let redisStatus = 'not_configured';
    try {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.ping();
      await client.disconnect();
      redisStatus = 'healthy';
    } catch (err) {
      redisStatus = 'unhealthy';
    }
    
    res.json({
      status: 'healthy',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: redisStatus,
        socketio: 'healthy'
      },
      connections: {
        websocket: io.sockets.sockets.size
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/api/', (req, res) => {
  res.json({
    message: 'SwanyBot Pro Ultimate API - Enhanced',
    version: '3.0.0',
    features: [
      'Authentication with JWT',
      'Claude AI Chat',
      'Stripe Payments',
      'Credits System',
      'Team Collaboration',
      'Stream Management',
      'Content Automation',
      'Rate Limiting',
      'Redis Caching',
      'Webhooks',
      'Analytics',
      'Job Queues',
      'Request Logging'
    ],
    endpoints: {
      auth: '/api/auth/*',
      chat: '/api/chat/*',
      streams: '/api/streams/*',
      payments: '/api/payments/*',
      users: '/api/users/*',
      teams: '/api/teams/*',
      automation: '/api/automation/*',
      analytics: '/api/analytics/*',
      webhooks: '/api/webhooks/*',
      health: '/api/health'
    }
  });
});

// WebSocket handling for real-time features
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join room based on user session
  socket.on('join', (data) => {
    const { userId, streamId } = data;
    if (streamId) {
      socket.join(`stream-${streamId}`);
      logger.info(`User ${userId} joined stream ${streamId}`);
    }
  });

  // Stream start
  socket.on('stream:start', async (data) => {
    const { streamId, userId, platforms } = data;
    socket.join(`stream-${streamId}`);
    
    // Broadcast to room
    io.to(`stream-${streamId}`).emit('stream:started', {
      streamId,
      userId,
      platforms,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Stream started: ${streamId} by ${userId}`);
  });

  // Stream metrics
  socket.on('stream:metrics', (data) => {
    const { streamId, metrics } = data;
    io.to(`stream-${streamId}`).emit('metrics:update', {
      streamId,
      metrics,
      timestamp: new Date().toISOString()
    });
  });

  // Stream stop
  socket.on('stream:stop', (data) => {
    const { streamId } = data;
    io.to(`stream-${streamId}`).emit('stream:stopped', {
      streamId,
      timestamp: new Date().toISOString()
    });
    socket.leave(`stream-${streamId}`);
    
    logger.info(`Stream stopped: ${streamId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 8002;
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`\n🚀 SwanyBot Pro Ultimate Server v3.0.0\n`);
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`✅ Socket.IO enabled`);
  logger.info(`✅ Rate limiting active`);
  logger.info(`✅ Request logging enabled`);
  logger.info(`\n🔗 API: http://localhost:${PORT}/api`);
  logger.info(`🔗 Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = { app, server, io };