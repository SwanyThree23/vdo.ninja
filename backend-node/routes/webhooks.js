const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');
const router = express.Router();

// Create webhook
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { url, events, is_active } = req.body;
    const userId = req.user.id;

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString('hex');

    const result = await db.query(
      `INSERT INTO webhooks (user_id, url, events, secret, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, url, JSON.stringify(events), secret, is_active !== false]
    );

    res.status(201).json({
      webhook: result.rows[0],
      secret // Return secret only once
    });
  } catch (error) {
    console.error('Webhook creation error:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Get user webhooks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, url, events, is_active, created_at, last_triggered_at
       FROM webhooks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ webhooks: result.rows });
  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Update webhook
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, events, is_active } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE webhooks
       SET url = COALESCE($1, url),
           events = COALESCE($2, events),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [url, events ? JSON.stringify(events) : null, is_active, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ webhook: result.rows[0] });
  } catch (error) {
    console.error('Webhook update error:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Webhook deletion error:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Trigger webhook (internal function)
async function triggerWebhook(userId, event, data) {
  try {
    // Get active webhooks for this user and event
    const result = await db.query(
      `SELECT * FROM webhooks
       WHERE user_id = $1 AND is_active = true
       AND events @> $2::jsonb`,
      [userId, JSON.stringify([event])]
    );

    for (const webhook of result.rows) {
      try {
        // Create signature
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(data))
          .digest('hex');

        // Send webhook
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event
          },
          body: JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString()
          })
        });

        // Log webhook call
        await db.query(
          `INSERT INTO webhook_logs (webhook_id, event, status_code, response)
           VALUES ($1, $2, $3, $4)`,
          [webhook.id, event, response.status, await response.text()]
        );

        // Update last triggered
        await db.query(
          'UPDATE webhooks SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = $1',
          [webhook.id]
        );
      } catch (err) {
        console.error(`Webhook trigger error for ${webhook.url}:`, err);
      }
    }
  } catch (error) {
    console.error('Webhook trigger error:', error);
  }
}

module.exports = { router, triggerWebhook };