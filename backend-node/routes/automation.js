const express = require('express');
const db = require('../db');
const { authMiddleware, checkCredits } = require('../middleware/auth');
const router = express.Router();

// Generate content (blog, video script, social posts)
router.post('/content/generate', authMiddleware, checkCredits(5), async (req, res) => {
  try {
    const { type, topic, length } = req.body;
    const userId = req.user.id;

    // Call Claude API for content generation
    const apiKey = process.env.EMERGENT_LLM_KEY;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Generate a ${type} about "${topic}". Length: approximately ${length} words. Make it engaging and SEO-optimized.`
        }]
      })
    });

    const data = await response.json();
    const content = data.content[0].text;

    // Extract title from content
    const title = content.split('\n')[0].replace(/^#\s*/, '');

    // Deduct credits
    await db.query('UPDATE users SET credits = credits - 5 WHERE id = $1', [userId]);
    await db.query(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [userId, -5, 'content_generation', `Generated ${type}`]
    );

    // Save to database
    const result = await db.query(
      `INSERT INTO ai_generations (user_id, type, prompt, result_url, credits_used, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, type, topic, null, 5, 'completed', JSON.stringify({ title, content, length })]
    );

    res.json({
      success: true,
      title,
      content,
      generation_id: result.rows[0].id,
      credits_used: 5
    });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({ error: 'Content generation failed' });
  }
});

// Create video from script
router.post('/content/video', authMiddleware, checkCredits(10), async (req, res) => {
  try {
    const { script, title } = req.body;
    const userId = req.user.id;

    // In production, integrate with HeyGen or similar
    // For now, simulate video generation
    const videoUrl = `https://storage.swanybot.com/videos/${Date.now()}.mp4`;

    // Deduct credits
    await db.query('UPDATE users SET credits = credits - 10 WHERE id = $1', [userId]);
    await db.query(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [userId, -10, 'video_generation', 'Generated video']
    );

    // Save to database
    await db.query(
      `INSERT INTO ai_generations (user_id, type, prompt, result_url, credits_used, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'video', script, videoUrl, 10, 'processing']
    );

    res.json({
      success: true,
      video_url: videoUrl,
      status: 'processing',
      credits_used: 10
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: 'Video generation failed' });
  }
});

// Repurpose content (video to blog, shorts, social)
router.post('/content/repurpose', authMiddleware, checkCredits(8), async (req, res) => {
  try {
    const { videoUrl, outputFormats } = req.body;
    const userId = req.user.id;

    // Simulate content repurposing
    const results = {
      blog: null,
      shorts: [],
      socialPosts: []
    };

    if (outputFormats.includes('blog')) {
      results.blog = {
        title: 'Repurposed Blog Post',
        content: 'Generated from video content...',
        seoScore: 85
      };
    }

    if (outputFormats.includes('shorts')) {
      results.shorts = [
        { platform: 'tiktok', url: 'https://tiktok.com/...' },
        { platform: 'youtube', url: 'https://youtube.com/shorts/...' },
        { platform: 'instagram', url: 'https://instagram.com/reels/...' }
      ];
    }

    if (outputFormats.includes('social')) {
      results.socialPosts = [
        { platform: 'twitter', text: 'Check out this video!', hashtags: ['AI', 'Tech'] },
        { platform: 'linkedin', text: 'Professional post about the video' }
      ];
    }

    // Deduct credits
    await db.query('UPDATE users SET credits = credits - 8 WHERE id = $1', [userId]);
    await db.query(
      'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [userId, -8, 'content_repurpose', 'Repurposed content']
    );

    res.json({
      success: true,
      results,
      credits_used: 8
    });
  } catch (error) {
    console.error('Content repurposing error:', error);
    res.status(500).json({ error: 'Content repurposing failed' });
  }
});

// SEO optimization
router.post('/seo/optimize', authMiddleware, checkCredits(3), async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    // Call Claude for SEO optimization
    const apiKey = process.env.EMERGENT_LLM_KEY;
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
        messages: [{
          role: 'user',
          content: `Optimize this content for SEO. Suggest keywords, meta description, and improvements:\n\n${content}`
        }]
      })
    });

    const data = await response.json();
    const suggestions = data.content[0].text;

    // Deduct credits
    await db.query('UPDATE users SET credits = credits - 3 WHERE id = $1', [userId]);

    res.json({
      success: true,
      suggestions,
      keywords: ['AI', 'technology', 'automation'],
      metaDescription: 'Auto-generated meta description',
      seoScore: 85,
      credits_used: 3
    });
  } catch (error) {
    console.error('SEO optimization error:', error);
    res.status(500).json({ error: 'SEO optimization failed' });
  }
});

// Publish to social media
router.post('/social/publish', authMiddleware, checkCredits(2), async (req, res) => {
  try {
    const { platforms, content, mediaUrl } = req.body;
    const userId = req.user.id;

    // Simulate social media publishing
    const results = platforms.map(platform => ({
      platform,
      status: 'published',
      url: `https://${platform}.com/posts/123`,
      timestamp: new Date()
    }));

    // Deduct credits
    await db.query('UPDATE users SET credits = credits - 2 WHERE id = $1', [userId]);

    res.json({
      success: true,
      results,
      credits_used: 2
    });
  } catch (error) {
    console.error('Social publish error:', error);
    res.status(500).json({ error: 'Social publishing failed' });
  }
});

// Create automation workflow
router.post('/workflows/create', authMiddleware, async (req, res) => {
  try {
    const { name, trigger, actions } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `INSERT INTO automation_workflows (user_id, name, trigger_type, actions, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, trigger, JSON.stringify(actions), true]
    );

    res.json({
      success: true,
      workflow: result.rows[0]
    });
  } catch (error) {
    console.error('Workflow creation error:', error);
    res.status(500).json({ error: 'Workflow creation failed' });
  }
});

// Get user workflows
router.get('/workflows', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT * FROM automation_workflows WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      workflows: result.rows
    });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

module.exports = router;