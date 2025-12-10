const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/automation', automationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'SwanyBot Pro Ultimate',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/api/', (req, res) => {
  res.json({
    message: 'SwanyBot Pro Ultimate API - Node.js',
    version: '1.0.0',
    features: [
      'Authentication',
      'Claude AI Chat',
      'Stripe Payments',
      'Credits System',
      'WebRTC Streaming',
      'Team Collaboration'
    ]
  });
});

// WebSocket handling for real-time features
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Join room based on user session
  socket.on('join', (data) => {
    const { userId, streamId } = data;
    if (streamId) {
      socket.join(`stream-${streamId}`);
      console.log(`User ${userId} joined stream ${streamId}`);
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
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 8002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 SwanyBot Pro Ultimate Server
`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ Socket.IO enabled`);
  console.log(`\n🔗 API: http://localhost:${PORT}/api`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = { app, server, io };