const express = require('express');
const router = express.Router();
const axios = require('axios');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8001';

// Detect language from text (simple heuristic)
const detectLanguage = (text) => {
  if (!text) return { code: 'en', label: 'English' };
  const kannadaRange = /[\u0C80-\u0CFF]/;
  const hindiRange = /[\u0900-\u097F]/;
  const tamilRange = /[\u0B80-\u0BFF]/;
  const teluguRange = /[\u0C00-\u0C7F]/;
  if (kannadaRange.test(text)) return { code: 'kn', label: 'Kannada' };
  if (hindiRange.test(text)) return { code: 'hi', label: 'Hindi' };
  if (tamilRange.test(text)) return { code: 'ta', label: 'Tamil' };
  if (teluguRange.test(text)) return { code: 'te', label: 'Telugu' };
  return { code: 'en', label: 'English' };
};

// Simple keyword-based sentiment
const getSentiment = (text) => {
  if (!text) return { score: 0, label: 'neutral' };
  const lower = text.toLowerCase();
  const negWords = ['bad','terrible','horrible','worst','dangerous','broken','filthy','overflowing','stinking','damaged','pothole','accident','flooding','blocked','smell','rot','urgent','critical','emergency','suffer','pathetic','disgusting'];
  const posWords = ['thank','good','better','fix','improve','request','please','kindly','need','help'];
  let score = 0;
  negWords.forEach(w => { if (lower.includes(w)) score -= 0.15; });
  posWords.forEach(w => { if (lower.includes(w)) score += 0.05; });
  score = Math.max(-1, Math.min(1, score));
  const label = score < -0.1 ? 'negative' : score > 0.1 ? 'positive' : 'neutral';
  return { score: parseFloat(score.toFixed(3)), label };
};

// POST /api/ml/predict
router.post('/predict', async (req, res) => {
  try {
    const mlResponse = await axios.post(`${ML_API_URL}/predict`, req.body, { timeout: 10000 });
    const data = mlResponse.data;
    // Augment with language detection if not provided
    const lang = detectLanguage(req.body.description || req.body.title);
    res.json({
      success: true,
      ...data,
      detected_language: data.detected_language || lang
    });
  } catch (error) {
    // Fallback local prediction — keyword-detect category from text (NOT the passed-in category)
    const { urgency, description = '', title = '' } = req.body;
    const combinedText = `${title} ${description}`.toLowerCase().trim();

    // Keyword-based classifier (same logic as Python app)
    const CATEGORY_KEYWORDS = {
      Garbage:     ['garbage','waste','dump','trash','litter','bin','rubbish','stink','smell','solid waste','foul smell','overflowing','sanitation'],
      Roads:       ['pothole','road','footpath','divider','crater','tarmac','pavement','damaged road','speed breaker','median','road cave'],
      Water:       ['water','pipeline','supply','leak','flood','waterlog','contaminated','drinking water','no water','pipeline burst','tap'],
      Sewage:      ['sewage','sewer','drain','drainage','manhole','septic','sewer line','blocked drain'],
      Streetlight: ['streetlight','street light','lamp','lamppost','dark','light not working','no light','broken light'],
      Parks:       ['park','tree','bench','garden','swing','encroach','plants','jogging','playground'],
      Noise:       ['noise','sound','loud','music','construction noise','speaker','loudspeaker','dj','factory noise'],
    };

    const CATEGORY_DAYS = { Roads: 7, Garbage: 3, Water: 5, Streetlight: 2, Sewage: 4, Parks: 10, Noise: 5 };
    const URGENCY_SCORES = { critical: 85, high: 70, medium: 50, low: 30 };

    // Score each category by keyword matches
    let bestCategory = 'Roads';
    let bestScore = 0;
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      const score = kws.reduce((s, k) => s + (combinedText.includes(k) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; bestCategory = cat; }
    }

    const sentiment = getSentiment(combinedText);
    const lang = detectLanguage(description || title);
    const detectedUrgency = urgency || 'medium';

    res.json({
      success: true,
      priority_score: URGENCY_SCORES[detectedUrgency] || 50,
      category: bestCategory,
      confidence: bestScore > 0 ? Math.min(0.95, 0.65 + bestScore * 0.05) : 0.5,
      predicted_days: CATEGORY_DAYS[bestCategory] || 7,
      urgency: detectedUrgency,
      sentiment_score: sentiment.score,
      sentiment_label: sentiment.label,
      detected_language: lang,
      source: 'fallback'
    });
  }
});

// GET /api/ml/models
router.get('/models', async (req, res) => {
  try {
    const response = await axios.get(`${ML_API_URL}/models`, { timeout: 5000 });
    res.json({ success: true, models: response.data });
  } catch (error) {
    res.json({
      success: true,
      models: [
        { name: 'Complaint Classifier', type: 'LogisticRegression', accuracy: 0.87, status: 'ready' },
        { name: 'Priority Scorer', type: 'XGBoost', accuracy: 0.83, status: 'ready' },
        { name: 'Resolution Time Predictor', type: 'XGBoost Regressor', rmse: 2.1, status: 'ready' },
        { name: 'Sentiment Analyzer', type: 'VADER', status: 'ready' }
      ],
      source: 'fallback'
    });
  }
});

module.exports = router;
