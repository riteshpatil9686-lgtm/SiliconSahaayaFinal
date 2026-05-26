const nodemailer = require('nodemailer');
const { query } = require('../db');

const createTransporter = () => nodemailer.createTransporter({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

const STATUS_MESSAGES = {
  submitted: 'Your complaint has been submitted successfully and is being processed by our AI system.',
  assigned: 'Your complaint has been assigned to the concerned department and will be addressed shortly.',
  in_progress: 'Work has begun on resolving your complaint. Our field team is on-site.',
  resolved: 'Great news! Your complaint has been resolved. Please rate your experience.',
  escalated: 'Your complaint has been escalated to senior officials for priority action.'
};

const sendNotificationEmail = async (email, complaintId, status) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured, skipping notification');
    return;
  }
  
  try {
    const transporter = createTransporter();
    const message = STATUS_MESSAGES[status] || `Your complaint ${complaintId} status has been updated to: ${status}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'SiliconSahaaya <noreply@siliconsahaaya.in>',
      to: email,
      subject: `[${complaintId}] Complaint ${status.replace(/_/g, ' ').toUpperCase()} - SiliconSahaaya`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #1a4731, #2d7a52); padding: 30px 40px; color: white;">
            <img src="https://via.placeholder.com/40x40/ff6b00/ffffff?text=SS" style="border-radius: 8px; margin-bottom: 10px;" alt="logo"/>
            <h1 style="margin: 0; font-size: 22px;">SiliconSahaaya</h1>
            <p style="margin: 5px 0 0; opacity: 0.8;">Civic Grievance Platform — Bengaluru</p>
          </div>
          <div style="background: #f8fffe; padding: 30px 40px;">
            <h2 style="color: #1a4731; margin-top: 0;">Complaint Update</h2>
            <p style="color: #333; line-height: 1.6;">${message}</p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #666; font-size: 13px;">Complaint ID</p>
              <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold; color: #ff6b00;">${complaintId}</p>
            </div>
            <p style="color: #666; font-size: 13px;">Track your complaint status at any time:</p>
            <a href="http://localhost:3000/track?id=${complaintId}" style="display: inline-block; background: linear-gradient(135deg, #ff6b00, #e85d00); color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Track Complaint →</a>
          </div>
          <div style="background: #1a4731; padding: 20px 40px; color: rgba(255,255,255,0.6); font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} SiliconSahaaya | BBMP Bengaluru | 1800-425-2225</p>
          </div>
        </div>`
    });
    
    console.log(`Email notification sent for complaint ${complaintId}`);
  } catch (error) {
    console.error('Email notification error:', error.message);
  }
};

module.exports = { sendNotificationEmail };
