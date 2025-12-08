const express = require('express');
const db = require('../db');
const { authMiddleware, checkCredits } = require('../middleware/auth');
const router = express.Router();

// Import emergent integrations (will use same library as Python backend)
let LlmChat, UserMessage;
try {
  // This would need the emergent integrations library ported to Node.js
  // For now, we'll use direct API calls
  console.log('⚠️  Emergent integrations not available in Node.js, using direct API');
} catch (e) {
  console.log('Using direct Claude API calls');
}

// Helper function to call Claude API directly
async function callClaudeAPI(messages, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: "You are SwanyBot Pro, an AI assistant for livestream creators. You help with streaming setup, content creation, video production, and multi-platform management. Be helpful, concise, and creative.",
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Chat endpoint
router.post('/', authMiddleware, checkCredits(1), async (req, res) => {
  try {
    const { message, session_id } = req.body;
    const userId = req.user.id;

    if (!message || !session_id) {
      return res.status(400).json({ error: 'Missing message or session_id' });
    }

    // Get chat history
    const historyResult = await db.query(
      `SELECT role, content FROM chat_messages
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at ASC
       LIMIT 50`,
      [userId, session_id]
    );

    const history = historyResult.rows;

    // Save user message
    await db.query(
      `INSERT INTO chat_messages (user_id, session_id, role, content, credits_used)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, session_id, 'user', message, 0]
    );

    // Build messages array
    const messages = [
      ...history,
      { role: 'user', content: message }
    ];

    // Call Claude API
    const apiKey = process.env.EMERGENT_LLM_KEY;
    const response = await callClaudeAPI(messages, apiKey);

    // Save assistant response
    await db.query(
      `INSERT INTO chat_messages (user_id, session_id, role, content, credits_used)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, session_id, 'assistant', response, 1]
    );

    // Deduct credits
    await db.query(
      'UPDATE users SET credits = credits - $1 WHERE id = $2',
      [1, userId]
    );

    // Log credit transaction
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, $3, $4)`,
      [userId, -1, 'chat', 'AI chat message']
    );

    // Get updated credits
    const creditsResult = await db.query(
      'SELECT credits FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      message: response,
      credits_remaining: creditsResult.rows[0].credits,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// Get chat history
router.get('/history/:session_id', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, role, content, credits_used, created_at
       FROM chat_messages
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at ASC
       LIMIT 100`,
      [userId, session_id]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

module.exports = router;