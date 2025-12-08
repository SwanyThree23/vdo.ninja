const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, email, username, full_name, avatar_url, credits, role, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, avatar_url } = req.body;

    const result = await db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           avatar_url = COALESCE($2, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, username, full_name, avatar_url, credits`,
      [full_name, avatar_url, userId]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get credit balance
router.get('/credits', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT credits FROM users WHERE id = $1',
      [userId]
    );

    res.json({ credits: result.rows[0].credits });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// Get credit transactions
router.get('/credits/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, amount, type, description, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;