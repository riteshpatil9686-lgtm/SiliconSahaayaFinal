const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../db');
const path = require('path');
const fs = require('fs');

// GET /api/reports/generate - generate PDF report
router.get('/generate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type = 'weekly', format = 'pdf' } = req.query;
    
    // Fetch data for report
    const [stats, departments, categories, recent, topCitizens] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) as pending,
        ROUND(AVG(citizen_rating),1) as avg_rating, ROUND(AVG(actual_resolution_days)) as avg_days
        FROM complaints WHERE created_at >= NOW() - INTERVAL '${type === 'weekly' ? '7' : '30'} days'`),
      query(`SELECT d.name, COUNT(c.id) as total, COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')) as resolved
        FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
        WHERE c.created_at >= NOW() - INTERVAL '${type === 'weekly' ? '7' : '30'} days'
        GROUP BY d.name ORDER BY total DESC`),
      query(`SELECT category, COUNT(*) as count FROM complaints WHERE created_at >= NOW() - INTERVAL '${type === 'weekly' ? '7' : '30'} days' GROUP BY category ORDER BY count DESC`),
      query(`SELECT complaint_id, title, category, status, urgency, created_at FROM complaints ORDER BY created_at DESC LIMIT 20`),
      query(`SELECT u.name, cp.total_points, cp.complaints_submitted FROM citizen_points cp JOIN users u ON u.id = cp.user_id ORDER BY cp.total_points DESC LIMIT 5`)
    ]);
    
    if (format === 'json') {
      return res.json({ success: true, report: { stats: stats.rows[0], departments: departments.rows, categories: categories.rows } });
    }
    
    // Generate HTML for PDF
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>SiliconSahaaya ${type === 'weekly' ? 'Weekly' : 'Monthly'} Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
    .header { background: linear-gradient(135deg, #1a4731, #2d7a52); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; margin-bottom: 5px; }
    .header p { opacity: 0.8; font-size: 14px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .kpi-card { background: #f8fffe; border: 1px solid #1a4731; border-radius: 8px; padding: 15px; text-align: center; }
    .kpi-value { font-size: 32px; font-weight: bold; color: #1a4731; }
    .kpi-label { font-size: 12px; color: #666; margin-top: 5px; }
    .section { margin-bottom: 25px; }
    .section h2 { color: #1a4731; font-size: 18px; border-bottom: 2px solid #ff6b00; padding-bottom: 8px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1a4731; color: white; padding: 10px 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f9f9f9; }
    .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge-critical { background: #fee2e2; color: #dc2626; }
    .badge-high { background: #fef3c7; color: #d97706; }
    .badge-medium { background: #dbeafe; color: #2563eb; }
    .badge-resolved { background: #dcfce7; color: #16a34a; }
    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌿 SiliconSahaaya City Intelligence Report</h1>
    <p>${type === 'weekly' ? 'Weekly' : 'Monthly'} Report — Generated on ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p>Bengaluru Urban District | Powered by AI & Data Analytics</p>
  </div>
  
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${stats.rows[0]?.total || 0}</div>
      <div class="kpi-label">Total Complaints</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color: #16a34a">${stats.rows[0]?.resolved || 0}</div>
      <div class="kpi-label">Resolved</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color: #ff6b00">${stats.rows[0]?.pending || 0}</div>
      <div class="kpi-label">Pending</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${stats.rows[0]?.avg_rating || 'N/A'}/5</div>
      <div class="kpi-label">Satisfaction Score</div>
    </div>
  </div>
  
  <div class="section">
    <h2>Department Performance</h2>
    <table>
      <thead><tr><th>Department</th><th>Total Complaints</th><th>Resolved</th><th>Resolution Rate</th></tr></thead>
      <tbody>
        ${departments.rows.map(d => `
          <tr>
            <td>${d.name}</td>
            <td>${d.total}</td>
            <td>${d.resolved}</td>
            <td>${d.total > 0 ? Math.round(d.resolved / d.total * 100) : 0}%</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>Category Breakdown</h2>
    <table>
      <thead><tr><th>Category</th><th>Count</th><th>Share</th></tr></thead>
      <tbody>
        ${categories.rows.map(c => `
          <tr><td>${c.category}</td><td>${c.count}</td><td>${Math.round(c.count / (stats.rows[0]?.total || 1) * 100)}%</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>Recent Complaints</h2>
    <table>
      <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>
        ${recent.rows.map(c => `
          <tr>
            <td><strong>${c.complaint_id}</strong></td>
            <td>${c.title.slice(0, 50)}...</td>
            <td>${c.category}</td>
            <td><span class="badge badge-${c.status === 'resolved' ? 'resolved' : c.urgency}">${c.status}</span></td>
            <td>${new Date(c.created_at).toLocaleDateString('en-IN')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>Top Citizen Contributors</h2>
    <table>
      <thead><tr><th>Rank</th><th>Citizen</th><th>Points</th><th>Complaints Submitted</th></tr></thead>
      <tbody>
        ${topCitizens.rows.map((c, i) => `
          <tr><td>${i+1}</td><td>${c.name || 'Anonymous'}</td><td>${c.total_points}</td><td>${c.complaints_submitted}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="footer">
    <p>Generated by SiliconSahaaya AI Platform | © ${new Date().getFullYear()} BBMP Bengaluru</p>
    <p>This report is auto-generated and contains real-time data from the civic grievance database.</p>
  </div>
</body>
</html>`;
    
    // Try puppeteer
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' });
      const page = await browser.newPage();
      await page.setContent(reportHtml, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
      await browser.close();
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SiliconSahaaya-${type}-report-${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdf.length
      });
      res.send(Buffer.from(pdf));
    } catch (puppeteerErr) {
      // Fallback: return HTML
      res.set('Content-Type', 'text/html');
      res.send(reportHtml);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

module.exports = router;
