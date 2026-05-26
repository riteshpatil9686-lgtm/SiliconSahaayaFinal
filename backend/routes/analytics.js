const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [weekly, categories, departments, satisfaction, wardHotspots, recentActivity] = await Promise.all([
      query(`SELECT DATE(created_at) as date, COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved
        FROM complaints WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) ORDER BY date`),
      query(`SELECT category, COUNT(*) as count, 
        ROUND(COUNT(*)::decimal / SUM(COUNT(*)) OVER() * 100, 1) as percentage
        FROM complaints GROUP BY category ORDER BY count DESC`),
      query(`SELECT d.name, d.code,
        COUNT(c.id) as total,
        ROUND(AVG(c.actual_resolution_days), 1) as avg_days,
        ROUND(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as resolution_rate
        FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.id, d.name, d.code`),
      query(`SELECT ROUND(AVG(citizen_rating), 2) as avg_rating, COUNT(*) FILTER (WHERE citizen_rating IS NOT NULL) as rated_count,
        COUNT(*) FILTER (WHERE citizen_rating >= 4) as positive,
        COUNT(*) FILTER (WHERE citizen_rating <= 2) as negative
        FROM complaints`),
      query(`SELECT w.name as ward_name, COUNT(c.id) as complaint_count, w.lat, w.lng
        FROM complaints c JOIN wards w ON w.id = c.ward_id
        GROUP BY w.id, w.name, w.lat, w.lng ORDER BY complaint_count DESC`),
      query(`SELECT complaint_id, category, status, urgency, created_at FROM complaints ORDER BY created_at DESC LIMIT 5`)
    ]);
    
    res.json({
      success: true,
      weekly_trend: weekly.rows,
      categories: categories.rows,
      departments: departments.rows,
      satisfaction: satisfaction.rows[0],
      ward_hotspots: wardHotspots.rows,
      recent_activity: recentActivity.rows
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/trends
router.get('/trends', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const result = await query(`
      SELECT DATE(created_at) as date, category, COUNT(*) as count
      FROM complaints WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'
      GROUP BY DATE(created_at), category ORDER BY date, category`);
    res.json({ success: true, trends: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/analytics/heatmap
router.get('/heatmap', async (req, res) => {
  try {
    const result = await query(`
      SELECT lat, lng, urgency, category, COUNT(*) as intensity
      FROM complaints WHERE lat IS NOT NULL AND lng IS NOT NULL
      GROUP BY lat, lng, urgency, category`);
    res.json({ success: true, heatmap: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/analytics/r-charts - proxy R Plumber API charts
router.get('/r-charts/:chartType', async (req, res) => {
  try {
    const axios = require('axios');
    const R_API_URL = process.env.R_API_URL || 'http://localhost:8000';
    const { chartType } = req.params;
    
    const validCharts = ['weekly-trend', 'category-pie', 'department-performance', 'resolution-histogram', 'satisfaction-score'];
    if (!validCharts.includes(chartType)) {
      return res.status(400).json({ success: false, message: 'Invalid chart type' });
    }
    
    const rResponse = await axios.get(`${R_API_URL}/plot/${chartType}`, { 
      responseType: 'arraybuffer',
      timeout: 15000
    });
    
    res.set('Content-Type', rResponse.headers['content-type'] || 'image/png');
    res.send(rResponse.data);
  } catch (error) {
    // Return a generated SVG chart as fallback
    res.set('Content-Type', 'image/svg+xml');
    const fallbackSVG = generateFallbackChart(req.params.chartType);
    res.send(fallbackSVG);
  }
});

function generateFallbackChart(type) {
  const colors = { primary: '#1a4731', secondary: '#ff6b00', accent: '#2d7a52' };
  return `<svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0d2418" rx="8"/>
    <text x="300" y="140" text-anchor="middle" fill="#ff6b00" font-family="Arial" font-size="16" font-weight="bold">
      ${type.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase())}
    </text>
    <text x="300" y="170" text-anchor="middle" fill="#ffffff80" font-family="Arial" font-size="12">
      Connect R Plumber API for live charts
    </text>
    <rect x="50" y="200" width="80" height="60" fill="${colors.primary}" rx="4"/>
    <rect x="150" y="180" width="80" height="80" fill="${colors.secondary}" rx="4"/>
    <rect x="250" y="220" width="80" height="40" fill="${colors.accent}" rx="4"/>
    <rect x="350" y="190" width="80" height="70" fill="${colors.primary}" rx="4"/>
    <rect x="450" y="210" width="80" height="50" fill="${colors.secondary}" rx="4"/>
  </svg>`;
}

module.exports = router;
