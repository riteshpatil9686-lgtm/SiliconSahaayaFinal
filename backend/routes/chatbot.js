const express = require('express');
const router = express.Router();
const axios = require('axios');
const { query } = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

const SYSTEM_PROMPT = `You are SiliconBot, an expert AI assistant for SiliconSahaaya — a civic grievance platform for Bengaluru, India. 

You help citizens with:
1. Submitting complaints about potholes, garbage, broken streetlights, water issues, sewage problems, park maintenance, and noise pollution
2. Tracking complaint status and escalation
3. Understanding department responsibilities and SLAs
4. Providing information about BBMP, BWSSB, BESCOM departments
5. Answering questions about the Swachhata mission

DEPARTMENTS:
- Roads & Infrastructure (ROADS): Potholes, road damage, footpaths — SLA: 7 days
- Solid Waste Management (SWM): Garbage collection, waste disposal — SLA: 3 days  
- Water Supply & Sewerage (BWSSB): Water supply, sewage, pipe leaks — SLA: 5 days
- Electricity & Streetlights (BESCOM): Streetlights, power issues — SLA: 2 days
- Parks & Gardens (PARKS): Park maintenance, trees, public spaces — SLA: 10 days

COMPLAINT ID FORMAT: SS-YYYY-XXXXXX (e.g., SS-2026-123456)
ESCALATION: If not resolved within SLA, complaint is auto-escalated

Always be helpful, empathetic, and professional. Respond in the user's language if they write in Hindi, Kannada, Tamil, or Telugu.

When a user provides a complaint ID, you can look it up. If they ask to submit, guide them to the Submit page.`;

// POST /api/chatbot/message
router.post('/message', optionalAuth, async (req, res) => {
  try {
    const { message, history = [], complaint_id, language = 'en' } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Check if user is asking about a specific complaint
    let complaintContext = '';
    const complaintIdMatch = message.match(/SS-\d{4}-\d{6}/i);
    const lookupId = complaint_id || (complaintIdMatch ? complaintIdMatch[0] : null);
    
    if (lookupId) {
      try {
        const complaintResult = await query(`
          SELECT c.complaint_id, c.title, c.category, c.status, c.urgency, c.priority_score,
            c.created_at, c.resolved_at, c.address, c.resolution_notes,
            d.name as department_name, d.sla_days,
            w.name as ward_name
          FROM complaints c
          LEFT JOIN departments d ON d.id = c.department_id
          LEFT JOIN wards w ON w.id = c.ward_id
          WHERE c.complaint_id ILIKE $1`, [lookupId.toUpperCase()]);
        
        if (complaintResult.rows.length) {
          const c = complaintResult.rows[0];
          complaintContext = `\n\nCOMPLAINT FOUND:\n- ID: ${c.complaint_id}\n- Title: ${c.title}\n- Category: ${c.category}\n- Status: ${c.status.toUpperCase()}\n- Urgency: ${c.urgency}\n- Priority Score: ${c.priority_score}/100\n- Department: ${c.department_name}\n- Ward: ${c.ward_name}\n- Submitted: ${new Date(c.created_at).toLocaleDateString('en-IN')}\n- ${c.resolved_at ? `Resolved: ${new Date(c.resolved_at).toLocaleDateString('en-IN')}` : `SLA: ${c.sla_days} days`}\n${c.resolution_notes ? `- Resolution: ${c.resolution_notes}` : ''}`;
        }
      } catch (dbErr) {
        console.error('DB lookup error:', dbErr);
      }
    }
    
    // Get live hotspot data for context
    const hotspots = await query(`
      SELECT w.name as ward, wh.category, wh.complaint_count, wh.hotspot_level
      FROM ward_hotspots wh JOIN wards w ON w.id = wh.ward_id
      WHERE wh.hotspot_level IN ('high', 'critical')
      ORDER BY wh.complaint_count DESC LIMIT 5`).catch(() => ({ rows: [] }));
    
    const hotspotContext = hotspots.rows.length ? 
      `\n\nCURRENT HOTSPOTS:\n${hotspots.rows.map(h => `- ${h.ward}: ${h.category} (${h.complaint_count} complaints, ${h.hotspot_level} level)`).join('\n')}` : '';
    
    // Build messages for Claude
    const messages = [
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message + complaintContext }
    ];
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    // Call Claude API
    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      // Demo response when no API key
      // Demo responses when no API key
      const demoResponses = {
        track: [
          "I'd be happy to track your complaint. Please share your Complaint ID (e.g., SS-YYYY-XXXXXX).",
          "Sure! To check the status, please provide the Complaint ID.",
          "I can help with that. What is your 12-character Complaint ID?"
        ],
        submit: [
          "To submit a new complaint, click 'Submit Complaint' from the menu. Our AI will automatically categorize it for you!",
          "Reporting an issue is easy! Head to the Submit page, upload a photo or write a description, and we'll take care of the rest.",
          "You can log a new civic issue using our Submit Complaint wizard. It only takes 2 minutes."
        ],
        escalate: [
          "If your complaint has crossed its SLA (like 7 days for Roads or 3 days for Garbage), you can go to the Track page and click 'Reopen / Escalate'.",
          "Sorry to hear it's taking longer than expected. Use your Complaint ID on the Track page to escalate the issue directly to the nodal officer."
        ],
        departments: [
          "We handle issues related to Roads (BBMP), Garbage (SWM), Water/Sewage (BWSSB), Streetlights (BESCOM), and Parks. Which one are you asking about?",
          "Our system automatically routes complaints to BBMP, BWSSB, or BESCOM based on what you report. SLA varies from 2 to 10 days."
        ],
        greetings: [
          "Hello! I am SiliconBot. How can I assist you with Bengaluru civic issues today?",
          "Namaskara! Welcome to SiliconSahaaya. Do you want to submit a complaint or track an existing one?",
          "Hi there! I'm here to help you report or track local problems like potholes or garbage. What's on your mind?"
        ],
        default: [
          "I'm sorry, I didn't quite catch that. Could you please specify if you want to submit a complaint, track an existing one, or escalate an issue?",
          "I am a demo AI assistant for SiliconSahaaya. You can ask me how to submit complaints, check statuses, or about our SLAs. Try asking 'How do I submit?'"
        ]
      };
      
      const lower = message.toLowerCase();
      let responseGroup = demoResponses.default;
      
      if (lower.includes('track') || lower.includes('status') || lower.includes('check') || lower.includes('ss-')) responseGroup = demoResponses.track;
      else if (lower.includes('submit') || lower.includes('report') || lower.includes('new complaint')) responseGroup = demoResponses.submit;
      else if (lower.includes('escalat') || lower.includes('delay') || lower.includes('not solved')) responseGroup = demoResponses.escalate;
      else if (lower.includes('department') || lower.includes('bbmp') || lower.includes('bwssb') || lower.includes('bescom')) responseGroup = demoResponses.departments;
      else if (lower.includes('hi ') || lower.includes('hello') || lower.includes('hey') || lower.includes('namaskar')) responseGroup = demoResponses.greetings;
      
      // Pick a random response from the selected group
      const response = responseGroup[Math.floor(Math.random() * responseGroup.length)];
      
      return res.json({ 
        success: true, 
        response, 
        demo: true, 
        note: 'Configure ANTHROPIC_API_KEY for real AI responses',
        complaint_found: !!complaintContext,
        hotspots: hotspots.rows
      });
    }
    
    const claudeResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT + hotspotContext,
        messages
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const aiResponse = claudeResponse.data.content[0].text;
    
    res.json({
      success: true,
      response: aiResponse,
      complaint_found: !!complaintContext,
      hotspots: hotspots.rows,
      usage: claudeResponse.data.usage
    });
  } catch (error) {
    console.error('Chatbot error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Chatbot error occurred',
      response: "I'm experiencing technical difficulties. Please try again or contact support at 1800-425-2225."
    });
  }
});

// GET /api/chatbot/hotspots
router.get('/hotspots', async (req, res) => {
  try {
    const result = await query(`
      SELECT w.name as ward, wh.category, wh.complaint_count, wh.hotspot_level, w.lat, w.lng
      FROM ward_hotspots wh 
      JOIN wards w ON w.id = wh.ward_id
      ORDER BY wh.complaint_count DESC LIMIT 10`);
    res.json({ success: true, hotspots: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
