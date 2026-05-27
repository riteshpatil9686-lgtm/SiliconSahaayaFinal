const nodemailer = require('nodemailer');
const { query } = require('../db');

const createTransporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const STATUS_MESSAGES = {
  submitted: 'Your complaint has been received and is being analyzed by our AI system. You will receive updates at every stage.',
  assigned: 'Your complaint has been assigned to the concerned department and a field officer will address it shortly.',
  in_progress: 'Great news! Work has begun on resolving your complaint. Our field team is currently on-site.',
  resolved: '🎉 Your complaint has been resolved successfully! Please take a moment to rate your experience.',
  escalated: 'Your complaint has been escalated to senior officials for priority action. We apologize for the delay.',
  ai_analyzed: 'Your complaint has been analyzed by our AI system and routed to the right department.'
};

const STATUS_COLORS = {
  submitted: '#2563eb',
  assigned: '#7c3aed',
  in_progress: '#d97706',
  resolved: '#16a34a',
  escalated: '#dc2626',
  ai_analyzed: '#0891b2'
};

const STATUS_LABELS = {
  submitted: 'SUBMITTED',
  assigned: 'ASSIGNED',
  in_progress: 'IN PROGRESS',
  resolved: 'RESOLVED ✓',
  escalated: 'ESCALATED',
  ai_analyzed: 'AI ANALYZED'
};

const buildEmailHtml = (complaintId, status, extraInfo = {}) => {
  const message = STATUS_MESSAGES[status] || `Your complaint ${complaintId} status has been updated to: ${status.replace(/_/g, ' ')}.`;
  const statusColor = STATUS_COLORS[status] || '#ff6b00';
  const statusLabel = STATUS_LABELS[status] || status.toUpperCase();
  const trackingUrl = `${FRONTEND_URL}/track?id=${complaintId}`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f2d1a 0%,#1a4731 50%,#2d7a52 100%);padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#ff6b00,#e85d00);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                      <span style="color:white;font-weight:bold;font-size:18px;">SS</span>
                    </div>
                    <div>
                      <div style="color:white;font-size:20px;font-weight:bold;letter-spacing:-0.3px;">SiliconSahaaya</div>
                      <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">Civic Grievance Platform · Bengaluru</div>
                    </div>
                  </div>
                </td>
                <td align="right">
                  <span style="background:${statusColor};color:white;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:bold;letter-spacing:0.5px;">${statusLabel}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#0f2d1a;font-size:22px;margin:0 0 8px;">Complaint Status Update</h2>
            <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 24px;">${message}</p>

            <!-- Complaint ID Box -->
            <div style="background:linear-gradient(135deg,#0f2d1a,#1a4731);border-radius:12px;padding:20px 24px;margin-bottom:24px;">
              <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.8px;">Your Complaint ID</p>
              <p style="color:#ff6b00;font-size:28px;font-weight:bold;margin:0;letter-spacing:1px;">${complaintId}</p>
              <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:8px 0 0;">Keep this ID to track or escalate your complaint</p>
            </div>

            ${extraInfo.details ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">${extraInfo.details}</div>` : ''}

            <p style="color:#6b7280;font-size:13px;margin:0 0 14px;">Track your complaint status in real-time:</p>

            <!-- CTA Button -->
            <a href="${trackingUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff6b00,#e85d00);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.3px;">Track Complaint Status →</a>

            <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">Or copy this link: <a href="${trackingUrl}" style="color:#ff6b00;word-break:break-all;">${trackingUrl}</a></p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0f2d1a;padding:20px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">© ${year} SiliconSahaaya | Powered by BBMP Bengaluru</p>
                  <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:4px 0 0;">Helpline: 1800-425-2225 · support@siliconsahaaya.in</p>
                </td>
                <td align="right">
                  <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">Do not reply to this email</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const sendNotificationEmail = async (email, complaintId, status, extraInfo = {}) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured — set EMAIL_USER and EMAIL_PASS in .env to enable Gmail notifications');
    return;
  }

  try {
    const transporter = createTransporter();
    const statusLabel = STATUS_LABELS[status] || status.toUpperCase();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `SiliconSahaaya <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `[${complaintId}] Complaint ${statusLabel} — SiliconSahaaya`,
      html: buildEmailHtml(complaintId, status, extraInfo)
    });

    console.log(`✉️  Email sent to ${email} for complaint ${complaintId} [${status}]`);
  } catch (error) {
    console.error('Email notification error:', error.message);
  }
};

// Send email when admin changes status
const sendStatusUpdateEmail = async (complaintId, newStatus, extraInfo = {}) => {
  try {
    const result = await query(
      `SELECT u.email, c.complaint_id FROM complaints c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1 OR c.complaint_id = $1`,
      [complaintId]
    );
    const row = result.rows[0];
    if (!row || !row.email) return;
    await sendNotificationEmail(row.email, row.complaint_id, newStatus, extraInfo);
  } catch (err) {
    console.error('sendStatusUpdateEmail error:', err.message);
  }
};

module.exports = { sendNotificationEmail, sendStatusUpdateEmail };
