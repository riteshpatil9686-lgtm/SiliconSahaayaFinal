const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/departments
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, 
        COUNT(c.id) as active_complaints,
        COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')) as resolved_complaints
      FROM departments d 
      LEFT JOIN complaints c ON c.department_id = d.id
      WHERE d.is_active = true
      GROUP BY d.id ORDER BY d.name`);
    res.json({ success: true, departments: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
});

// GET /api/departments/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, 
        COUNT(c.id) as total_complaints,
        COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')) as resolved,
        ROUND(AVG(c.actual_resolution_days), 1) as avg_resolution_days,
        ROUND(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as resolution_rate
      FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
      WHERE d.id = $1 GROUP BY d.id`, [req.params.id]);
    
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, department: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
