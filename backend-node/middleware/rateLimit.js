const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Try to connect to Redis, fallback to memory store
let redisClient;
try {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  redisClient.connect().catch(() => {
    console.log('⚠️  Redis not available, using memory store for rate limiting');
    redisClient = null;
  });
} catch (err) {
  console.log('⚠️  Redis not available, using memory store for rate limiting');
  redisClient = null;
}

const createRateLimiter = (options = {}) => {
  const config = {
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };

  // Use Redis store if available
  if (redisClient) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: 'rate_limit:'
    });
  }

  return rateLimit(config);
};

// Different rate limiters for different endpoints
const limiter = {
  // General API rate limit
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100
  }),

  // Strict limit for authentication
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.'
  }),

  // Chat API limit
  chat: createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20,
    message: 'Chat rate limit exceeded. Please slow down.'
  }),

  // Content generation limit
  generation: createRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: 'Content generation rate limit exceeded.'
  })
};

module.exports = { limiter, createRateLimiter };