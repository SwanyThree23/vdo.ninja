const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Create stream
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { title, description, platforms, team_id } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await db.query(
      `INSERT INTO streams (id, user_id, team_id, title, description, platforms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        uuidv4(),
        userId,
        team_id || null,
        title,
        description || null,
        JSON.stringify(platforms || ['youtube', 'twitch']),
        'idle'
      ]
    );

    res.status(201).json({ stream: result.rows[0] });
  } catch (error) {
    console.error('Create stream error:', error);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// Start stream
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check ownership
    const checkResult = await db.query(
      'SELECT * FROM streams WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Update stream status
    const result = await db.query(
      `UPDATE streams
       SET status = $1, started_at = $2, updated_at = $3
       WHERE id = $4
       RETURNING *`,
      ['live', new Date(), new Date(), id]
    );

    // Emit to Socket.IO
    const io = req.app.get('io');
    io.to(`stream-${id}`).emit('stream:started', {
      streamId: id,
      userId,
      timestamp: new Date().toISOString()
    });

    res.json({ stream: result.rows[0] });
  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

// Stop stream
router.post('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE streams
       SET status = $1, ended_at = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      ['ended', new Date(), new Date(), id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Emit to Socket.IO
    const io = req.app.get('io');
    io.to(`stream-${id}`).emit('stream:stopped', {
      streamId: id,
      timestamp: new Date().toISOString()
    });

    res.json({ stream: result.rows[0] });
  } catch (error) {
    console.error('Stop stream error:', error);
    res.status(500).json({ error: 'Failed to stop stream' });
  }
});

// Save metrics
router.post('/:id/metrics', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { fps, bitrate, viewers } = req.body;

    await db.query(
      `INSERT INTO stream_metrics (stream_id, fps, bitrate, viewers)
       VALUES ($1, $2, $3, $4)`,
      [id, fps, bitrate, viewers]
    );

    // Update peak viewers
    await db.query(
      `UPDATE streams
       SET viewers_peak = GREATEST(viewers_peak, $1),
           total_views = total_views + 1
       WHERE id = $2`,
      [viewers, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save metrics error:', error);
    res.status(500).json({ error: 'Failed to save metrics' });
  }
});

// Get user streams
router.get('/my-streams', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = 'SELECT * FROM streams WHERE user_id = $1';
    const params = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await db.query(query, params);

    res.json({ streams: result.rows });
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// Get stream details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM streams WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Get metrics
    const metricsResult = await db.query(
      `SELECT * FROM stream_metrics
       WHERE stream_id = $1
       ORDER BY timestamp DESC
       LIMIT 100`,
      [id]
    );

    res.json({
      stream: result.rows[0],
      metrics: metricsResult.rows
    });
  } catch (error) {
    console.error('Get stream error:', error);
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

module.exports = router;