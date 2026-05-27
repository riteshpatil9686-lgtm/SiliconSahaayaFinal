const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendStatusUpdateEmail } = require('../utils/notifications');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Multer for after-image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'complaints');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `after-${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10485760 }, fileFilter: (req, file, cb) => {
  if (/jpeg|jpg|png|webp/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Images only'));
}});

// GET /api/admin/overview
router.get('/overview', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [kpis, recent, departments, wardHotspots] = await Promise.all([
      query(`SELECT 
        COUNT(*) as total_complaints,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed','submitted')) as in_progress,
        COUNT(*) FILTER (WHERE status = 'submitted' OR status = 'ai_analyzed') as pending,
        ROUND(AVG(actual_resolution_days)) as avg_resolution_days,
        ROUND(AVG(citizen_rating), 1) as avg_satisfaction,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_submitted,
        COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE) as today_resolved,
        COUNT(*) FILTER (WHERE urgency = 'critical') as critical_pending,
        COUNT(DISTINCT user_id) as unique_citizens
        FROM complaints`),
      query(`SELECT c.complaint_id, c.title, c.category, c.status, c.urgency, c.priority_score, c.created_at,
        u.name as citizen_name, d.name as department_name
        FROM complaints c 
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN departments d ON d.id = c.department_id
        ORDER BY c.created_at DESC LIMIT 10`),
      query(`SELECT d.name, d.code,
        COUNT(c.id) as total,
        COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')) as resolved,
        COUNT(c.id) FILTER (WHERE c.status NOT IN ('resolved','closed','submitted','ai_analyzed')) as active,
        ROUND(AVG(c.actual_resolution_days)) as avg_days,
        d.sla_days,
        ROUND(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::decimal / NULLIF(COUNT(c.id),0) * 100) as resolution_rate
        FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.id, d.name, d.code, d.sla_days ORDER BY total DESC`),
      query(`SELECT w.name as ward_name, wh.category, wh.complaint_count, wh.hotspot_level
        FROM ward_hotspots wh JOIN wards w ON w.id = wh.ward_id ORDER BY wh.complaint_count DESC LIMIT 10`)
    ]);
    
    res.json({
      success: true,
      kpis: kpis.rows[0],
      recent_complaints: recent.rows,
      departments: departments.rows,
      ward_hotspots: wardHotspots.rows
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch overview' });
  }
});

// GET /api/admin/complaints - full management table
router.get('/complaints', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category, department_id, urgency, search, sort = 'created_at', order = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let conditions = [];
    let params = [];
    let idx = 1;
    
    if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }
    if (category) { conditions.push(`c.category = $${idx++}`); params.push(category); }
    if (department_id) { conditions.push(`c.department_id = $${idx++}`); params.push(department_id); }
    if (urgency) { conditions.push(`c.urgency = $${idx++}`); params.push(urgency); }
    if (search) {
      conditions.push(`(c.title ILIKE $${idx} OR c.complaint_id ILIKE $${idx} OR u.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const [data, count] = await Promise.all([
      query(`SELECT c.*, u.name as citizen_name, u.phone as citizen_phone,
        d.name as department_name, w.name as ward_name
        FROM complaints c
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN wards w ON w.id = c.ward_id
        ${where}
        ORDER BY c.${['created_at','priority_score','urgency'].includes(sort) ? sort : 'created_at'} ${order === 'ASC' ? 'ASC' : 'DESC'}
        LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]),
      query(`SELECT COUNT(*) FROM complaints c LEFT JOIN users u ON u.id = c.user_id ${where}`, params)
    ]);
    
    res.json({ 
      success: true, 
      complaints: data.rows, 
      pagination: { total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(parseInt(count.rows[0].count)/parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// PUT /api/admin/complaints/:id/assign
router.put('/complaints/:id/assign', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, officer_id, notes, expected_completion } = req.body;
    
    await query(
      `UPDATE complaints SET department_id = COALESCE($1, department_id), status = 'assigned', updated_at = NOW() WHERE id = $2`,
      [department_id, id]
    );
    
    if (officer_id) {
      await query(
        `INSERT INTO complaint_assignments (complaint_id, assigned_to, department_id, assigned_by, assignment_notes, expected_completion)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [id, officer_id, department_id, req.user.id, notes, expected_completion]
      );
    }
    
    await query(
      'INSERT INTO complaint_timeline (complaint_id, status, description, performed_by, role) VALUES ($1,$2,$3,$4,$5)',
      [id, 'assigned', notes || 'Complaint assigned to department', req.user.id, 'admin']
    );
    
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'ASSIGN_COMPLAINT', 'complaint', id, JSON.stringify({ department_id, officer_id })]
    );

    // Send email notification to citizen
    sendStatusUpdateEmail(id, 'assigned').catch(console.error);

    res.json({ success: true, message: 'Complaint assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to assign complaint' });
  }
});

// PUT /api/admin/complaints/:id/resolve
router.put('/complaints/:id/resolve', authenticate, authorize('admin', 'field_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes, after_image_url, action_taken } = req.body;
    
    const complaint = await query('SELECT * FROM complaints WHERE id = $1', [id]);
    if (!complaint.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    
    const c = complaint.rows[0];
    const resolutionDays = c.created_at ? 
      Math.ceil((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    await query(
      `UPDATE complaints SET status = 'resolved', resolution_notes = $1, 
       resolved_at = NOW(), actual_resolution_days = $2, updated_at = NOW() WHERE id = $3`,
      [resolution_notes, resolutionDays, id]
    );
    
    await query(
      `INSERT INTO resolutions (complaint_id, resolved_by, resolution_description, action_taken, after_image_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user.id, resolution_notes, action_taken, after_image_url]
    );
    
    if (after_image_url) {
      await query(
        'INSERT INTO complaint_images (complaint_id, image_url, image_type, uploaded_by) VALUES ($1,$2,$3,$4)',
        [id, after_image_url, 'after', req.user.id]
      );
    }
    
    await query(
      'INSERT INTO complaint_timeline (complaint_id, status, description, performed_by, role) VALUES ($1,$2,$3,$4,$5)',
      [id, 'resolved', resolution_notes, req.user.id, req.user.role]
    );
    
    // Award citizen points
    if (c.user_id) {
      await query(
        `UPDATE citizen_points SET total_points = total_points + 20, complaints_resolved = complaints_resolved + 1 WHERE user_id = $1`,
        [c.user_id]
      );
    }

    // Send email notification to citizen
    sendStatusUpdateEmail(id, 'resolved').catch(console.error);

    res.json({ success: true, message: 'Complaint resolved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resolve complaint' });
  }
});

// PUT /api/admin/complaints/:id/escalate
router.put('/complaints/:id/escalate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await query(
      `UPDATE complaints SET status = 'escalated', escalation_level = escalation_level + 1, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    
    await query(
      'INSERT INTO complaint_timeline (complaint_id, status, description, performed_by, role) VALUES ($1,$2,$3,$4,$5)',
      [id, 'escalated', reason || 'Escalated by admin', req.user.id, 'admin']
    );

    // Send email notification to citizen
    sendStatusUpdateEmail(id, 'escalated').catch(console.error);

    res.json({ success: true, message: 'Complaint escalated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to escalate' });
  }
});

// GET /api/admin/analytics/weekly
router.get('/analytics/weekly', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT DATE(created_at) as date, 
        COUNT(*) as submitted,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved
      FROM complaints 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/admin/users
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const result = await query(`
      SELECT u.id, u.phone, u.name, u.email, u.role, u.is_active, u.created_at,
        cp.total_points, cp.level, cp.complaints_submitted
      FROM users u 
      LEFT JOIN citizen_points cp ON cp.user_id = u.id
      WHERE u.role = 'citizen'
      ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]);
    
    const count = await query(`SELECT COUNT(*) FROM users WHERE role = 'citizen'`);
    
    res.json({ 
      success: true, 
      users: result.rows,
      pagination: { total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/admin/departments/routing
router.get('/departments/routing', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT d.name, d.code, d.sla_days,
        COUNT(c.id) as total_assigned,
        COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')) as resolved,
        COUNT(c.id) FILTER (WHERE c.status NOT IN ('resolved','closed')) as pending,
        ROUND(AVG(c.actual_resolution_days), 1) as avg_resolution_days,
        ROUND(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as accuracy_pct,
        ROUND(COUNT(c.id) FILTER (WHERE c.actual_resolution_days <= d.sla_days)::decimal / NULLIF(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')),0) * 100, 1) as sla_compliance
      FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
      GROUP BY d.id, d.name, d.code, d.sla_days ORDER BY total_assigned DESC`);
    
    res.json({ success: true, departments: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/admin/eta-predictions
router.get('/eta-predictions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT c.complaint_id, c.title, c.category, c.urgency, c.priority_score,
        c.predicted_resolution_days, c.actual_resolution_days, c.status, c.created_at,
        d.name as department_name
      FROM complaints c LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.predicted_resolution_days IS NOT NULL
      ORDER BY c.created_at DESC LIMIT 100`);
    
    res.json({ success: true, predictions: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT al.*, u.name as user_name, u.role
      FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC LIMIT 100`);
    res.json({ success: true, logs: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// POST /api/admin/complaints/:id/after-image — upload after-work photo
router.post('/complaints/:id/after-image', authenticate, authorize('admin', 'field_officer'), upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });

    const imageUrl = `/uploads/complaints/${req.file.filename}`;

    // Remove previous 'after' images for this complaint (keep latest only)
    await query(`DELETE FROM complaint_images WHERE complaint_id = $1 AND image_type = 'after'`, [id]);

    await query(
      'INSERT INTO complaint_images (complaint_id, image_url, image_type, uploaded_by) VALUES ($1,$2,$3,$4)',
      [id, imageUrl, 'after', req.user.id]
    );

    // Also update the resolution record if exists
    await query(
      `UPDATE resolutions SET after_image_url = $1 WHERE complaint_id = $2`,
      [imageUrl, id]
    ).catch(() => {});

    res.json({ success: true, image_url: imageUrl, message: 'After image uploaded successfully' });
  } catch (error) {
    console.error('After image upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

// GET /api/admin/complaints/:id/images — get all images for a complaint
router.get('/complaints/:id/images', authenticate, authorize('admin', 'field_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT ci.*, u.name as uploaded_by_name
       FROM complaint_images ci
       LEFT JOIN users u ON u.id = ci.uploaded_by
       WHERE ci.complaint_id = $1
       ORDER BY ci.image_type, ci.created_at`,
      [id]
    );
    res.json({ success: true, images: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch images' });
  }
});

module.exports = router;
