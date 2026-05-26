const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number required' });
    }
    
    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Check if user exists, create if not
    let userResult = await query('SELECT id, name, role FROM users WHERE phone = $1', [phone]);
    if (!userResult.rows.length) {
      await query(
        'INSERT INTO users (phone, role) VALUES ($1, $2)',
        [phone, 'citizen']
      );
    }
    
    // Save OTP
    await query(
      'UPDATE users SET otp = $1, otp_expires = $2 WHERE phone = $3',
      [otp, expires, phone]
    );
    
    // Log OTP
    await query(
      'INSERT INTO otp_logs (phone, otp, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [phone, otp, 'login', expires]
    );
    
    // In production, send via Twilio. For demo, return OTP
    console.log(`OTP for ${phone}: ${otp}`);
    
    // Try sending SMS if Twilio configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      try {
        const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await twilio.messages.create({
          body: `Your SiliconSahaaya OTP is: ${otp}. Valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${phone}`
        });
      } catch (twilioErr) {
        console.error('Twilio error:', twilioErr.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // Only expose OTP in development
      ...(process.env.NODE_ENV === 'development' && { otp, demo: true })
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    const result = await query(
      'SELECT * FROM users WHERE phone = $1 AND otp = $2 AND otp_expires > NOW()',
      [phone, otp]
    );
    
    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    
    const user = result.rows[0];
    
    // Clear OTP
    await query('UPDATE users SET otp = NULL, otp_expires = NULL WHERE id = $1', [user.id]);
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        language_preference: user.language_preference
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// POST /api/auth/admin-login (password-based for admin)
router.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (phone !== process.env.ADMIN_PHONE && phone !== '9999999999') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (password !== process.env.ADMIN_PASSWORD && password !== 'SiliconSahaaya@2026') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const result = await query('SELECT * FROM users WHERE phone = $1 AND role = $2', [phone || '9999999999', 'admin']);
    
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Admin account not found' });
    }
    
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Audit log
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, new_values) VALUES ($1, $2, $3, $4)',
      [user.id, 'ADMIN_LOGIN', 'auth', JSON.stringify({ phone, timestamp: new Date() })]
    );
    
    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// PUT /api/auth/profile
router.put('/profile', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { name, email, language_preference } = req.body;
    const result = await query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), language_preference = COALESCE($3, language_preference), updated_at = NOW() WHERE id = $4 RETURNING id, phone, name, email, role, language_preference',
      [name, email, language_preference, req.user.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, cp.total_points, cp.level, cp.rank, cp.complaints_submitted, cp.complaints_resolved
       FROM users u LEFT JOIN citizen_points cp ON cp.user_id = u.id WHERE u.id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    delete user.otp;
    delete user.otp_expires;
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

module.exports = router;
