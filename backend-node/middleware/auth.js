const jwt = require('jsonwebtoken');
const db = require('../db');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await db.query(
      'SELECT id, email, username, full_name, credits, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check if user has enough credits
const checkCredits = (requiredCredits) => {
  return async (req, res, next) => {
    try {
      const result = await db.query(
        'SELECT credits FROM users WHERE id = $1',
        [req.user.id]
      );

      const currentCredits = result.rows[0].credits;

      if (currentCredits < requiredCredits) {
        return res.status(403).json({
          error: 'Insufficient credits',
          required: requiredCredits,
          current: currentCredits
        });
      }

      next();
    } catch (error) {
      console.error('Credits check error:', error);
      res.status(500).json({ error: 'Failed to check credits' });
    }
  };
};

module.exports = { authMiddleware, checkCredits };