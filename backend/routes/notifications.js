const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../db');
const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

// POST /api/notifications/send-email
router.post('/send-email', authenticate, async (req, res) => {
  try {
    const { to_email, complaint_id, subject, body } = req.body;
    
    // Check permission: either user is admin, or they are citizen updating their own complaint
    if (req.user.role !== 'admin') {
      if (!complaint_id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
      const ownerCheck = await query('SELECT user_id FROM complaints WHERE id = $1 OR complaint_id = $1', [complaint_id]);
      if (!ownerCheck.rows.length || ownerCheck.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized: You can only send updates for your own complaints' });
      }
    }
    
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'SiliconSahaaya <noreply@siliconsahaaya.in>',
      to: to_email,
      subject: subject || `Update on your complaint ${complaint_id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a4731; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">SiliconSahaaya</h2>
            <p style="margin: 5px 0; opacity: 0.8;">Civic Grievance Platform</p>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <p>${body}</p>
            ${complaint_id ? `<p><strong>Complaint ID:</strong> ${complaint_id}</p>` : ''}
            <hr/>
            <p style="font-size: 12px; color: #666;">This is an automated message from SiliconSahaaya.</p>
          </div>
        </div>
      `
    });
    
    await query(`INSERT INTO email_logs (to_email, subject, body, type, complaint_id, sent_by, status) 
      VALUES ($1, $2, $3, 'email', $4, $5, 'sent')`,
      [to_email, subject, body, complaint_id, req.user.id]);
    
    res.json({ success: true, message: 'Email sent', messageId: info.messageId });
  } catch (error) {
    console.error('Email error:', error);
    await query(`INSERT INTO email_logs (to_email, subject, body, type, complaint_id, sent_by, status, error_message) 
      VALUES ($1, $2, $3, 'email', $4, $5, 'failed', $6)`,
      [req.body.to_email, req.body.subject, req.body.body, req.body.complaint_id, req.user?.id, error.message]).catch(() => {});
    res.status(500).json({ success: false, message: 'Email failed: ' + error.message });
  }
});

// GET /api/notifications/email-logs
router.get('/email-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`SELECT el.*, u.name as sent_by_name, c.complaint_id as complaint_ref
      FROM email_logs el LEFT JOIN users u ON u.id = el.sent_by
      LEFT JOIN complaints c ON c.id = el.complaint_id
      ORDER BY el.sent_at DESC LIMIT 100`);
    res.json({ success: true, logs: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/notifications/my-notifications
router.get('/my-notifications', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT n.*, c.complaint_id as complaint_ref
      FROM notifications n LEFT JOIN complaints c ON c.id = n.complaint_id
      WHERE n.user_id = $1 ORDER BY n.sent_at DESC LIMIT 50`, [req.user.id]);
    res.json({ success: true, notifications: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
