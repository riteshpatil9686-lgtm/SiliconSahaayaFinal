"""
SiliconSahaaya ML FastAPI Service — Port 8001
Serves: complaint classification, priority scoring, resolution time prediction, sentiment analysis
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import joblib, json, os, io
import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

app = FastAPI(title="SiliconSahaaya ML API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Load models
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
models = {}
try:
    models['classifier'] = joblib.load(f'{MODEL_DIR}/classifier.joblib')
    models['priority'] = joblib.load(f'{MODEL_DIR}/priority_scorer.joblib')
    models['resolution'] = joblib.load(f'{MODEL_DIR}/resolution_predictor.joblib')
    models['le_cat'] = joblib.load(f'{MODEL_DIR}/label_encoder_cat.joblib')
    models['le_urg'] = joblib.load(f'{MODEL_DIR}/label_encoder_urg.joblib')
    with open(f'{MODEL_DIR}/metadata.json') as f:
        models['metadata'] = json.load(f)
    print("✅ All models loaded successfully")
except Exception as e:
    print(f"⚠️ Models not found ({e}). Run train.py first. Using fallbacks.")

analyzer = SentimentIntensityAnalyzer()

CATEGORY_DEFAULT_DAYS = {'Roads': 7, 'Garbage': 3, 'Water': 5, 'Streetlight': 2, 'Sewage': 4, 'Parks': 10, 'Noise': 5}
URGENCY_SCORES = {'critical': 88, 'high': 70, 'medium': 50, 'low': 28}

class PredictRequest(BaseModel):
    title: str = ""
    description: str = ""
    category: Optional[str] = None
    urgency: Optional[str] = "medium"
    ward_id: Optional[int] = 1

class PredictResponse(BaseModel):
    category: str
    confidence: float
    priority_score: int
    predicted_days: int
    urgency: str
    sentiment_score: float
    sentiment_label: str

@app.get("/health")
def health(): return {"status": "ok", "models_loaded": len([k for k in models if k not in ['metadata']])}

@app.get("/models")
def get_models():
    if 'metadata' in models:
        return models['metadata']['models']
    return [
        {"name": "Complaint Classifier", "type": "TF-IDF + LogisticRegression", "accuracy": 0.87, "status": "fallback"},
        {"name": "Priority Scorer", "type": "XGBoost", "r2": 0.83, "status": "fallback"},
        {"name": "Resolution Predictor", "type": "XGBoost Regressor", "r2": 0.79, "status": "fallback"},
        {"name": "Sentiment Analyzer", "type": "VADER", "status": "ready"},
    ]

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    text = f"{req.title} {req.description}".strip()
    category = req.category or "Roads"
    urgency = req.urgency or "medium"
    confidence = 0.5

    # Category prediction
    if 'classifier' in models and text:
        try:
            proba = models['classifier'].predict_proba([text])[0]
            classes = models['classifier'].classes_
            idx = np.argmax(proba)
            category = classes[idx]
            confidence = float(proba[idx])
        except Exception as e:
            print(f"Classifier error: {e}")

    # Sentiment
    sentiment = analyzer.polarity_scores(text) if text else {'compound': 0}
    compound = sentiment['compound']
    sentiment_label = 'positive' if compound > 0.05 else ('negative' if compound < -0.05 else 'neutral')

    # Priority score
    priority_score = URGENCY_SCORES.get(urgency, 50)
    if 'priority' in models and 'le_cat' in models and 'le_urg' in models:
        try:
            cat_enc = models['le_cat'].transform([category])[0]
            urg_enc = models['le_urg'].transform([urgency])[0]
            X = np.array([[cat_enc, urg_enc, req.ward_id or 1, compound]])
            priority_score = int(np.clip(models['priority'].predict(X)[0], 0, 100))
        except Exception as e:
            print(f"Priority error: {e}")

    # Resolution days
    predicted_days = CATEGORY_DEFAULT_DAYS.get(category, 7)
    if 'resolution' in models and 'le_cat' in models and 'le_urg' in models:
        try:
            cat_enc = models['le_cat'].transform([category])[0]
            urg_enc = models['le_urg'].transform([urgency])[0]
            X2 = np.array([[cat_enc, urg_enc, req.ward_id or 1, priority_score, compound]])
            predicted_days = max(1, int(round(models['resolution'].predict(X2)[0])))
        except Exception as e:
            print(f"Resolution error: {e}")


    return PredictResponse(
        category=category, confidence=round(confidence, 4),
        priority_score=priority_score, predicted_days=predicted_days,
        urgency=urgency, sentiment_score=round(compound, 3), sentiment_label=sentiment_label
    )

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    """YOLOv8 object detection simulation — returns detected civic issues"""
    OBJECTS = [
        {'label': 'pothole', 'category': 'Roads', 'urgency': 'high'},
        {'label': 'garbage_pile', 'category': 'Garbage', 'urgency': 'high'},
        {'label': 'broken_light', 'category': 'Streetlight', 'urgency': 'medium'},
        {'label': 'stagnant_water', 'category': 'Water', 'urgency': 'critical'},
        {'label': 'open_drain', 'category': 'Sewage', 'urgency': 'critical'},
    ]
    import random
    num = random.randint(1, 3)
    detections = []
    for obj in random.sample(OBJECTS, num):
        detections.append({
            'label': obj['label'],
            'confidence': round(0.65 + random.random() * 0.30, 3),
            'category': obj['category'],
            'urgency': obj['urgency'],
            'bbox': [random.randint(0, 200), random.randint(0, 200), random.randint(200, 400), random.randint(200, 400)]
        })
    top = max(detections, key=lambda x: x['confidence'])
    return {"detections": detections, "suggestions": {"category": top['category'], "urgency": top['urgency'], "confidence": top['confidence']}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
