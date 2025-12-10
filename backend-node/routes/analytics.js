const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get user analytics
router.get('/user/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get credit usage stats
    const creditStats = await db.query(
      `SELECT 
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as credits_spent,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credits_earned,
        COUNT(*) as total_transactions
       FROM credit_transactions
       WHERE user_id = $1`,
      [userId]
    );

    // Get content generation stats
    const contentStats = await db.query(
      `SELECT 
        type,
        COUNT(*) as count,
        SUM(credits_used) as total_credits,
        AVG(credits_used) as avg_credits
       FROM ai_generations
       WHERE user_id = $1
       GROUP BY type`,
      [userId]
    );

    // Get stream stats
    const streamStats = await db.query(
      `SELECT 
        COUNT(*) as total_streams,
        SUM(viewers_peak) as total_peak_viewers,
        AVG(viewers_peak) as avg_peak_viewers
       FROM streams
       WHERE user_id = $1`,
      [userId]
    );

    // Get chat stats
    const chatStats = await db.query(
      `SELECT 
        COUNT(*) as total_messages,
        SUM(credits_used) as credits_on_chat
       FROM chat_messages
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      credits: creditStats.rows[0],
      content: contentStats.rows,
      streams: streamStats.rows[0],
      chat: chatStats.rows[0]
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get platform analytics (admin only)
router.get('/platform/stats', authMiddleware, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Total users
    const userStats = await db.query(
      'SELECT COUNT(*) as total_users, SUM(credits) as total_credits FROM users'
    );

    // Active users (last 7 days)
    const activeUsers = await db.query(
      `SELECT COUNT(DISTINCT user_id) as active_users
       FROM chat_messages
       WHERE created_at > NOW() - INTERVAL '7 days'`
    );

    // Revenue stats
    const revenueStats = await db.query(
      `SELECT 
        SUM(amount) as total_revenue,
        COUNT(*) as total_payments,
        AVG(amount) as avg_payment
       FROM payments
       WHERE status = 'completed'`
    );

    // Popular content types
    const contentTypes = await db.query(
      `SELECT type, COUNT(*) as count
       FROM ai_generations
       GROUP BY type
       ORDER BY count DESC`
    );

    res.json({
      users: {
        ...userStats.rows[0],
        ...activeUsers.rows[0]
      },
      revenue: revenueStats.rows[0],
      content_types: contentTypes.rows
    });
  } catch (error) {
    console.error('Platform analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

// Get usage trends
router.get('/trends', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;

    // Daily credit usage
    const creditTrend = await db.query(
      `SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as credits_used
       FROM credit_transactions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [userId]
    );

    // Daily content generation
    const contentTrend = await db.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as generations
       FROM ai_generations
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [userId]
    );

    res.json({
      credit_usage: creditTrend.rows,
      content_generation: contentTrend.rows
    });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Export analytics data
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user data
    const transactions = await db.query(
      'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const generations = await db.query(
      'SELECT * FROM ai_generations WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const streams = await db.query(
      'SELECT * FROM streams WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Format as CSV or JSON
    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      transactions: transactions.rows,
      generations: generations.rows,
      streams: streams.rows
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="swanybot-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;