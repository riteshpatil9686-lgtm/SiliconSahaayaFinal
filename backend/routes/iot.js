const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('./uploads', 'iot');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10485760 } });

// YOLO object to complaint category mapping
const YOLO_TO_CATEGORY = {
  'garbage_pile': { category: 'Garbage', urgency: 'high', title: 'Garbage pile detected' },
  'pothole': { category: 'Roads', urgency: 'high', title: 'Pothole detected on road' },
  'broken_light': { category: 'Streetlight', urgency: 'medium', title: 'Broken streetlight detected' },
  'stagnant_water': { category: 'Water', urgency: 'critical', title: 'Waterlogging detected' },
  'open_drain': { category: 'Sewage', urgency: 'critical', title: 'Open drain detected' },
  'fallen_tree': { category: 'Parks', urgency: 'high', title: 'Fallen tree blocking path' },
  'damaged_bench': { category: 'Parks', urgency: 'low', title: 'Damaged park bench' },
  'illegal_dumping': { category: 'Garbage', urgency: 'high', title: 'Illegal garbage dumping' },
  'graffiti': { category: 'Noise', urgency: 'low', title: 'Graffiti/vandalism' },
  'flooded_road': { category: 'Water', urgency: 'critical', title: 'Road flooding detected' }
};

// POST /api/iot/analyze - analyze uploaded image
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file required' });
    }
    
    const imageUrl = `/uploads/iot/${req.file.filename}`;
    
    // Try real YOLO API first
    let detections = [];
    const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8001';
    
    try {
      const formData = new (require('form-data'))();
      formData.append('file', fs.createReadStream(req.file.path));
      
      const yoloResponse = await axios.post(`${ML_API_URL}/detect`, formData, {
        headers: formData.getHeaders(),
        timeout: 10000
      });
      
      detections = yoloResponse.data.detections || [];
    } catch (yoloErr) {
      // Simulate YOLO detection for demo
      console.log('YOLO API unavailable, using simulation');
      const simulatedObjects = ['garbage_pile', 'pothole', 'stagnant_water', 'broken_light', 'open_drain'];
      const numDetections = 1 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < numDetections; i++) {
        const obj = simulatedObjects[Math.floor(Math.random() * simulatedObjects.length)];
        detections.push({
          label: obj,
          confidence: 0.65 + Math.random() * 0.30,
          bbox: [
            Math.floor(Math.random() * 200),
            Math.floor(Math.random() * 200),
            Math.floor(200 + Math.random() * 200),
            Math.floor(200 + Math.random() * 200)
          ]
        });
      }
    }
    
    // Map to complaint fields
    let suggestedCategory = null;
    let suggestedUrgency = 'medium';
    let suggestedTitle = '';
    let topConfidence = 0;
    
    for (const det of detections) {
      if (det.confidence > topConfidence && YOLO_TO_CATEGORY[det.label]) {
        topConfidence = det.confidence;
        const mapping = YOLO_TO_CATEGORY[det.label];
        suggestedCategory = mapping.category;
        suggestedUrgency = mapping.urgency;
        suggestedTitle = mapping.title;
      }
    }
    
    // Check if near known smart bin location (IoT simulation)
    const isSmartBin = suggestedCategory === 'Garbage' && Math.random() > 0.7;
    
    res.json({
      success: true,
      imageUrl,
      detections,
      suggestions: {
        category: suggestedCategory,
        urgency: suggestedUrgency,
        title: suggestedTitle,
        confidence: topConfidence
      },
      iot_source: isSmartBin ? 'IoT-SmartBin' : 'web',
      is_smart_bin: isSmartBin,
      demo: detections.length > 0 && !process.env.YOLO_AVAILABLE
    });
  } catch (error) {
    console.error('IoT analyze error:', error);
    res.status(500).json({ success: false, message: 'Image analysis failed' });
  }
});

// POST /api/iot/smart-bin-alert - simulate IoT smart bin
router.post('/smart-bin-alert', async (req, res) => {
  try {
    const { bin_id, location, fill_level, lat, lng } = req.body;
    
    if (fill_level >= 80) {
      // Auto-generate complaint
      const { query } = require('../db');
      const adminUser = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
      
      if (adminUser.rows.length) {
        const year = new Date().getFullYear();
        const complaintId = `SS-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
        
        await query(`
          INSERT INTO complaints (complaint_id, user_id, title, description, category, urgency, priority_score, lat, lng, source, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [complaintId, adminUser.rows[0].id, 
           `Smart Bin Full - ${bin_id}`,
           `IoT sensor reports garbage bin ${bin_id} is ${fill_level}% full. Immediate collection required.`,
           'Garbage', fill_level > 90 ? 'critical' : 'high', fill_level,
           lat, lng, 'iot', 'submitted']
        );
        
        return res.json({ success: true, message: 'Smart bin alert processed', complaint_id: complaintId });
      }
    }
    
    res.json({ success: true, message: 'Smart bin data received', action: fill_level >= 80 ? 'alert_triggered' : 'monitoring' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Smart bin alert failed' });
  }
});

module.exports = router;
