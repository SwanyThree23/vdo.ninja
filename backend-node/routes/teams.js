const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Create team
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create team
      const teamResult = await client.query(
        `INSERT INTO teams (id, name, owner_id, description)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [uuidv4(), name, userId, description || null]
      );

      const team = teamResult.rows[0];

      // Add creator as team member
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [team.id, userId, 'owner']
      );

      await client.query('COMMIT');

      res.status(201).json({ team });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get user teams
router.get('/my-teams', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT t.*, tm.role, u.username as owner_username
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       JOIN users u ON t.owner_id = u.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Add team member
router.post('/:id/members', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_email, role } = req.body;
    const userId = req.user.id;

    // Check if requester is team owner
    const teamCheck = await db.query(
      'SELECT * FROM teams WHERE id = $1 AND owner_id = $2',
      [id, userId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only team owner can add members' });
    }

    // Get user to add
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [user_email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newUserId = userResult.rows[0].id;

    // Add member
    await db.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [id, newUserId, role || 'member']
    );

    res.json({ message: 'Member added successfully' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Get team members
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, tm.role, tm.joined_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [id]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

module.exports = router;