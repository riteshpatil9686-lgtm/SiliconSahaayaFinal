const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');
const axios = require('axios');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'complaints');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Generate complaint ID
const generateComplaintId = (year) => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `SS-${year}-${num}`;
};

// GET /api/complaints - list with filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1, limit = 20, status, category, ward_id, urgency,
      search, sort = 'created_at', order = 'DESC', user_id
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = [];
    let params = [];
    let paramIdx = 1;
    
    if (status) { conditions.push(`c.status = $${paramIdx++}`); params.push(status); }
    if (category) { conditions.push(`c.category = $${paramIdx++}`); params.push(category); }
    if (ward_id) { conditions.push(`c.ward_id = $${paramIdx++}`); params.push(parseInt(ward_id)); }
    if (urgency) { conditions.push(`c.urgency = $${paramIdx++}`); params.push(urgency); }
    if (user_id) { conditions.push(`c.user_id = $${paramIdx++}`); params.push(user_id); }
    if (search) {
      conditions.push(`(c.title ILIKE $${paramIdx} OR c.description ILIKE $${paramIdx} OR c.complaint_id ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSortFields = ['created_at', 'priority_score', 'urgency', 'status', 'category'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
    
    const dataQuery = `
      SELECT c.*, 
        u.name as citizen_name, u.phone as citizen_phone,
        d.name as department_name, d.code as department_code,
        w.name as ward_name,
        (SELECT COUNT(*) FROM complaint_images ci WHERE ci.complaint_id = c.id) as image_count
      FROM complaints c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN wards w ON w.id = c.ward_id
      ${whereClause}
      ORDER BY c.${sortField} ${sortOrder}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    
    const countQuery = `SELECT COUNT(*) FROM complaints c ${whereClause}`;
    
    const [dataResult, countResult] = await Promise.all([
      query(dataQuery, [...params, parseInt(limit), offset]),
      query(countQuery, params)
    ]);
    
    res.json({
      success: true,
      complaints: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// GET /api/complaints/stats - dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [totals, today, weekly, categories, departments] = await Promise.all([
      query(`SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed', 'submitted')) as in_progress,
        COUNT(*) FILTER (WHERE status = 'submitted') as pending,
        ROUND(AVG(actual_resolution_days)) as avg_resolution_days,
        ROUND(AVG(citizen_rating), 1) as avg_satisfaction,
        COUNT(DISTINCT ward_id) as active_wards
        FROM complaints`),
      query(`SELECT 
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_submitted,
        COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE) as today_resolved
        FROM complaints`),
      query(`SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM complaints 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) ORDER BY date`),
      query(`SELECT category, COUNT(*) as count FROM complaints GROUP BY category ORDER BY count DESC`),
      query(`SELECT d.name, d.code, COUNT(c.id) as total,
        COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')) as resolved,
        ROUND(AVG(c.actual_resolution_days)) as avg_days
        FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.id, d.name, d.code ORDER BY total DESC`)
    ]);
    
    res.json({
      success: true,
      stats: {
        ...totals.rows[0],
        ...today.rows[0],
        weekly_trend: weekly.rows,
        categories: categories.rows,
        departments: departments.rows
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// GET /api/complaints/map - complaint pins for map
router.get('/map', async (req, res) => {
  try {
    const result = await query(`
      SELECT complaint_id, title, category, status, urgency, lat, lng, 
        ward_id, created_at, priority_score
      FROM complaints 
      WHERE lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY created_at DESC LIMIT 500`);
    res.json({ success: true, complaints: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch map data' });
  }
});

// GET /api/complaints/:id - single complaint
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Support lookup by complaint_id (SS-YYYY-XXXXXX) or UUID
    const isComplaintId = id.startsWith('SS-');
    const whereClause = isComplaintId ? 'c.complaint_id = $1' : 'c.id = $1';
    
    const result = await query(`
      SELECT c.*, 
        u.name as citizen_name, u.phone as citizen_phone, u.email as citizen_email,
        d.name as department_name, d.code as department_code, d.head_email, d.head_phone,
        d.sla_days,
        w.name as ward_name, w.zone
      FROM complaints c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN wards w ON w.id = c.ward_id
      WHERE ${whereClause}`, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    
    const complaint = result.rows[0];
    
    // Get images
    const images = await query(
      'SELECT * FROM complaint_images WHERE complaint_id = $1 ORDER BY created_at',
      [complaint.id]
    );
    
    // Get timeline
    const timeline = await query(
      `SELECT ct.*, u.name as performed_by_name 
       FROM complaint_timeline ct 
       LEFT JOIN users u ON u.id = ct.performed_by
       WHERE ct.complaint_id = $1 ORDER BY ct.created_at`,
      [complaint.id]
    );
    
    // Get resolution
    const resolution = await query(
      'SELECT * FROM resolutions WHERE complaint_id = $1 ORDER BY created_at DESC LIMIT 1',
      [complaint.id]
    );
    
    // Update view count
    await query('UPDATE complaints SET view_count = view_count + 1 WHERE id = $1', [complaint.id]);
    
    res.json({
      success: true,
      complaint: {
        ...complaint,
        images: images.rows,
        timeline: timeline.rows,
        resolution: resolution.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaint' });
  }
});

// POST /api/complaints - submit new complaint
router.post('/', authenticate, upload.array('images', 5), async (req, res) => {
  try {
    const {
      title, description, category, subcategory, urgency,
      ward_id, address, landmark, lat, lng, pincode, language,
      original_description, source = 'web'
    } = req.body;
    
    // Generate complaint ID
    const year = new Date().getFullYear();
    let complaintId = generateComplaintId(year);
    
    // Ensure unique
    let exists = await query('SELECT id FROM complaints WHERE complaint_id = $1', [complaintId]);
    while (exists.rows.length) {
      complaintId = generateComplaintId(year);
      exists = await query('SELECT id FROM complaints WHERE complaint_id = $1', [complaintId]);
    }
    
    // Get ML prediction for priority, category confirmation
    let priorityScore = 50;
    let mlCategory = category;
    let mlConfidence = 0.0;
    let predictedDays = 7;
    
    try {
      const mlResponse = await axios.post(`${process.env.ML_API_URL}/predict`, {
        title, description, category, ward_id: parseInt(ward_id) || 1, urgency
      }, { timeout: 5000 });
      
      if (mlResponse.data) {
        priorityScore = mlResponse.data.priority_score || 50;
        mlCategory = mlResponse.data.category || category;
        mlConfidence = mlResponse.data.confidence || 0.0;
        predictedDays = mlResponse.data.predicted_days || 7;
      }
    } catch (mlErr) {
      console.log('ML API not available, using defaults');
      // Fallback priority calculation
      const urgencyMap = { critical: 90, high: 70, medium: 50, low: 30 };
      priorityScore = urgencyMap[urgency] || 50;
    }
    
    // Map category to department
    const deptResult = await query(
      'SELECT id FROM departments WHERE $1 = ANY(categories) OR code = $2 LIMIT 1',
      [category, category.toUpperCase()]
    );
    
    const categoryToDept = {
      'Roads': 'd1000000-0000-0000-0000-000000000001',
      'Garbage': 'd1000000-0000-0000-0000-000000000002',
      'Water': 'd1000000-0000-0000-0000-000000000003',
      'Sewage': 'd1000000-0000-0000-0000-000000000003',
      'Streetlight': 'd1000000-0000-0000-0000-000000000004',
      'Parks': 'd1000000-0000-0000-0000-000000000005',
      'Noise': 'd1000000-0000-0000-0000-000000000001'
    };
    const departmentId = deptResult.rows[0]?.id || categoryToDept[category];
    
    // Duplicate detection
    const duplicateCheck = await query(`
      SELECT id, complaint_id FROM complaints 
      WHERE category = $1 AND ward_id = $2 
        AND status NOT IN ('resolved', 'closed')
        AND created_at > NOW() - INTERVAL '7 days'
        AND similarity(description, $3) > 0.4
      LIMIT 1`, [category, parseInt(ward_id) || 1, description]
    ).catch(() => ({ rows: [] }));
    
    const isDuplicate = duplicateCheck.rows.length > 0;
    const duplicateOf = isDuplicate ? duplicateCheck.rows[0].id : null;
    
    // Insert complaint
    const complaintResult = await query(`
      INSERT INTO complaints (
        complaint_id, user_id, title, description, category, subcategory,
        status, urgency, priority_score, ward_id, department_id,
        address, landmark, lat, lng, pincode, language, original_description,
        source, is_duplicate, duplicate_of, ml_category, ml_confidence,
        predicted_resolution_days
      ) VALUES ($1,$2,$3,$4,$5,$6,'ai_analyzed',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [
        complaintId, req.user.id, title, description, category, subcategory,
        urgency, priorityScore, parseInt(ward_id) || 1, departmentId,
        address, landmark, lat ? parseFloat(lat) : null, lng ? parseFloat(lng) : null,
        pincode, language || 'en', original_description, source,
        isDuplicate, duplicateOf, mlCategory, mlConfidence, predictedDays
      ]
    );
    
    const complaint = complaintResult.rows[0];
    
    // Save uploaded images
    if (req.files && req.files.length) {
      for (const file of req.files) {
        const imageUrl = `/uploads/complaints/${file.filename}`;
        await query(
          'INSERT INTO complaint_images (complaint_id, image_url, image_type, uploaded_by) VALUES ($1, $2, $3, $4)',
          [complaint.id, imageUrl, 'before', req.user.id]
        );
      }
    }
    
    // Timeline entry
    await query(
      'INSERT INTO complaint_timeline (complaint_id, status, description, performed_by, role) VALUES ($1, $2, $3, $4, $5)',
      [complaint.id, 'submitted', 'Complaint submitted by citizen', req.user.id, 'citizen']
    );
    
    await query(
      'INSERT INTO complaint_timeline (complaint_id, status, description, role) VALUES ($1, $2, $3, $4)',
      [complaint.id, 'ai_analyzed', `AI analyzed: Category ${mlCategory}, Priority Score ${priorityScore}`, 'system']
    );
    
    // Update citizen points
    await query(`
      INSERT INTO citizen_points (user_id, total_points, complaints_submitted, level)
      VALUES ($1, 10, 1, 'Newcomer')
      ON CONFLICT (user_id) DO UPDATE 
      SET total_points = citizen_points.total_points + 10,
          complaints_submitted = citizen_points.complaints_submitted + 1,
          updated_at = NOW()`,
      [req.user.id]
    );
    
    // In-app notification
    await query(
      `INSERT INTO notifications (user_id, complaint_id, type, title, message)
       VALUES ($1, $2, 'in_app', $3, $4)`,
      [req.user.id, complaint.id, 'Complaint Submitted', 
       `Your complaint ${complaintId} has been submitted and is being analyzed.`]
    );
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('new-complaint', {
        complaint_id: complaintId,
        category,
        urgency,
        ward_id,
        created_at: new Date()
      });
    }
    
    // Send email notification (non-blocking)
    const { sendNotificationEmail } = require('../utils/notifications');
    const userResult = await query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows[0]?.email) {
      sendNotificationEmail(userResult.rows[0].email, complaintId, 'submitted').catch(console.error);
    }
    
    res.status(201).json({
      success: true,
      message: isDuplicate ? 
        `Complaint submitted (possible duplicate of ${duplicateCheck.rows[0].complaint_id})` : 
        'Complaint submitted successfully',
      complaint_id: complaintId,
      complaint,
      is_duplicate: isDuplicate,
      priority_score: priorityScore,
      ml_category: mlCategory,
      predicted_resolution_days: predictedDays
    });
  } catch (error) {
    console.error('Submit complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit complaint' });
  }
});

// PUT /api/complaints/:id/rate - citizen rating
router.put('/:id/rate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
    }
    
    await query(
      'UPDATE complaints SET citizen_rating = $1, citizen_feedback = $2 WHERE id = $3 AND user_id = $4',
      [rating, feedback, id, req.user.id]
    );
    
    res.json({ success: true, message: 'Rating submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit rating' });
  }
});

// PUT /api/complaints/:id/reopen
router.put('/:id/reopen', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await query(
      `UPDATE complaints SET status = 'reopened', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND status IN ('resolved', 'closed') RETURNING *`,
      [id, req.user.id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Complaint not found or cannot be reopened' });
    }
    
    await query(
      'INSERT INTO complaint_timeline (complaint_id, status, description, performed_by, role) VALUES ($1, $2, $3, $4, $5)',
      [id, 'reopened', reason || 'Citizen not satisfied with resolution', req.user.id, 'citizen']
    );
    
    res.json({ success: true, message: 'Complaint reopened' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reopen complaint' });
  }
});

// PUT /api/complaints/:id/upvote
router.put('/:id/upvote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE complaints SET upvote_count = upvote_count + 1 WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/complaints/:id/translate
router.get('/:id/translate', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'hi' } = req.query;
    
    const result = await query('SELECT title, description FROM complaints WHERE id = $1 OR complaint_id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    
    const { title, description } = result.rows[0];
    
    // Try LibreTranslate
    try {
      const [titleTrans, descTrans] = await Promise.all([
        axios.post('https://libretranslate.com/translate', { q: title, source: 'en', target: lang }, { timeout: 5000 }),
        axios.post('https://libretranslate.com/translate', { q: description, source: 'en', target: lang }, { timeout: 5000 })
      ]);
      res.json({ success: true, title: titleTrans.data.translatedText, description: descTrans.data.translatedText });
    } catch {
      res.json({ success: true, title, description, note: 'Translation service unavailable' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Translation failed' });
  }
});

module.exports = router;
