const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// GET /api/users/profile (my profile)
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [user, points, badges, complaints] = await Promise.all([
      query('SELECT id, phone, name, email, role, language_preference, created_at FROM users WHERE id = $1', [req.user.id]),
      query('SELECT * FROM citizen_points WHERE user_id = $1', [req.user.id]),
      query('SELECT * FROM badges WHERE user_id = $1 ORDER BY earned_at DESC', [req.user.id]),
      query(`SELECT complaint_id, title, category, status, urgency, created_at, citizen_rating 
        FROM complaints WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [req.user.id])
    ]);
    
    res.json({
      success: true,
      user: user.rows[0],
      points: points.rows[0] || { total_points: 0, level: 'Newcomer', complaints_submitted: 0 },
      badges: badges.rows,
      complaints: complaints.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// GET /api/users/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.name, u.phone, cp.total_points, cp.level, cp.complaints_submitted, cp.complaints_resolved, cp.rank,
        COUNT(b.id) as badge_count
      FROM citizen_points cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN badges b ON b.user_id = u.id
      WHERE u.role = 'citizen'
      GROUP BY u.name, u.phone, cp.total_points, cp.level, cp.complaints_submitted, cp.complaints_resolved, cp.rank
      ORDER BY cp.total_points DESC LIMIT 10`);
    
    res.json({ success: true, leaderboard: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

// GET /api/users/notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT n.*, c.complaint_id, c.title as complaint_title
      FROM notifications n 
      LEFT JOIN complaints c ON c.id = n.complaint_id
      WHERE n.user_id = $1 ORDER BY n.sent_at DESC LIMIT 50`, [req.user.id]);
    
    res.json({ success: true, notifications: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// PUT /api/users/notifications/:id/read
router.put('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
