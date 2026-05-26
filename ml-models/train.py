"""
SiliconSahaaya ML Training Script
Trains: Complaint Classifier, Priority Scorer, Resolution Time Predictor
Generates 10,000 synthetic complaints for training
"""
# pyrefly: ignore [missing-import
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import xgboost as xgb
import joblib
import os
import random
import json
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

np.random.seed(42)
random.seed(42)
os.makedirs('models', exist_ok=True)

CATEGORIES = ['Roads', 'Garbage', 'Water', 'Streetlight', 'Sewage', 'Parks', 'Noise']
URGENCIES = ['low', 'medium', 'high', 'critical']

TEMPLATES = {
    'Roads': [
        "Large pothole on {road} causing accidents and vehicle damage",
        "Road caved in near {area} after heavy rain, completely blocked",
        "Footpath broken and unusable near {landmark}",
        "Speed breaker damaged and dangerous for vehicles on {road}",
        "Road divider broken causing accidents near {area}",
        "Deep crater formed on main road near {landmark}, vehicles swerving dangerously",
    ],
    'Garbage': [
        "Garbage overflowing from bin near {landmark} for {days} days",
        "Illegal garbage dumping on {road} blocking footpath",
        "Garbage not collected from {area} for past {days} days causing health hazard",
        "Open burning of garbage near {landmark} causing air pollution",
        "Garbage pile near {area} attracting stray animals and insects",
    ],
    'Water': [
        "No water supply in {area} for past {days} days",
        "Water pipeline burst near {landmark} flooding the road",
        "Stagnant water on {road} causing mosquito breeding",
        "Water meter damaged and leaking near {area}",
        "Contaminated water supply in {area} causing illness",
        "Waterlogging near {landmark} after heavy rain",
    ],
    'Streetlight': [
        "Streetlight not working on {road} for {days} days causing accidents",
        "Multiple streetlights broken on stretch near {area}",
        "Streetlight wire hanging dangerously near {landmark}",
        "Street light flickering and creating safety hazard on {road}",
    ],
    'Sewage': [
        "Sewage overflow near {area} creating health hazard",
        "Open drain emitting foul smell near {landmark}",
        "Sewer manhole open and dangerous near {road}",
        "Sewage pipeline broken on {road} causing flooding",
        "Sewage water mixing with drinking water supply in {area}",
    ],
    'Parks': [
        "Park benches broken and dangerous near {landmark}",
        "Tree fallen in {area} park blocking pathways",
        "Park lights not working in {area} creating unsafe conditions",
        "Illegal encroachment on park land near {landmark}",
        "Park swings broken and dangerous for children in {area}",
    ],
    'Noise': [
        "Loud construction noise at midnight near {area} disturbing residents",
        "Unauthorized loudspeaker usage near {landmark} past midnight",
        "Industrial noise pollution from factory near {area}",
        "Loud music from bar or restaurant near {landmark} past 10 PM",
    ]
}

AREAS = ['Koramangala', 'Indiranagar', 'Whitefield', 'Jayanagar', 'Malleswaram', 
         'HSR Layout', 'Marathahalli', 'BTM Layout', 'JP Nagar', 'Bannerghatta Road']
ROADS = ['MG Road', 'Old Airport Road', 'Outer Ring Road', 'Sarjapur Road', 'Hosur Road']
LANDMARKS = ['near BBMP park', 'behind bus stand', 'opposite school', 'near metro station', 'beside hospital']

def generate_description(category):
    template = random.choice(TEMPLATES[category])
    return template.format(
        road=random.choice(ROADS),
        area=random.choice(AREAS),
        landmark=random.choice(LANDMARKS),
        days=random.randint(1, 14)
    )

print("🔧 Generating 20,000 synthetic training records...")
records = []
for _ in range(20000):
    cat = random.choice(CATEGORIES)
    urgency = random.choices(URGENCIES, weights=[0.3, 0.4, 0.2, 0.1])[0]
    ward = random.randint(1, 5)
    description = generate_description(cat)
    
    # Calculate sentiment to affect priority
    sentiment = analyzer.polarity_scores(description)['compound']
    
    base_priority = {'critical': random.randint(70, 90), 'high': random.randint(50, 75),
                'medium': random.randint(30, 60), 'low': random.randint(10, 40)}[urgency]
                
    # Lower sentiment (more negative) -> higher priority
    priority = int(min(100, max(0, base_priority - (sentiment * 10))))
    
    dep_days = {'Roads': random.uniform(3, 14), 'Garbage': random.uniform(1, 5),
                'Water': random.uniform(2, 8), 'Streetlight': random.uniform(1, 4),
                'Sewage': random.uniform(2, 10), 'Parks': random.uniform(5, 21),
                'Noise': random.uniform(2, 10)}[cat]
    records.append({
        'description': description,
        'category': cat,
        'urgency': urgency,
        'ward_id': ward,
        'sentiment_score': sentiment,
        'priority_score': priority,
        'resolution_days': dep_days + random.uniform(-1, 3)
    })

df = pd.DataFrame(records)
print(f"✅ Generated {len(df)} records")
print(df['category'].value_counts())

# 1. COMPLAINT CLASSIFIER (TF-IDF + Logistic Regression)
print("\n🤖 Training Complaint Classifier...")
X_train, X_test, y_train, y_test = train_test_split(df['description'], df['category'], test_size=0.2, random_state=42)
classifier_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=5000, ngram_range=(1, 2), stop_words='english')),
    ('clf', LogisticRegression(max_iter=1000, C=5.0, random_state=42))
])
classifier_pipeline.fit(X_train, y_train)
y_pred = classifier_pipeline.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"✅ Classifier Accuracy: {acc:.3f}")
print(classification_report(y_test, y_pred))
joblib.dump(classifier_pipeline, 'models/classifier.joblib')

# 2. PRIORITY SCORER (XGBoost)
print("\n🎯 Training Priority Scorer...")
le_cat = LabelEncoder()
le_urg = LabelEncoder()
df['category_enc'] = le_cat.fit_transform(df['category'])
df['urgency_enc'] = le_urg.fit_transform(df['urgency'])
X_priority = df[['category_enc', 'urgency_enc', 'ward_id', 'sentiment_score']]
y_priority = df['priority_score']
X_tr, X_te, y_tr, y_te = train_test_split(X_priority, y_priority, test_size=0.2, random_state=42)
priority_model = xgb.XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42)
priority_model.fit(X_tr, y_tr)
r2 = priority_model.score(X_te, y_te)
print(f"✅ Priority Scorer R²: {r2:.3f}")
joblib.dump(priority_model, 'models/priority_scorer.joblib')
joblib.dump(le_cat, 'models/label_encoder_cat.joblib')
joblib.dump(le_urg, 'models/label_encoder_urg.joblib')

# 3. RESOLUTION TIME PREDICTOR (XGBoost Regressor)
print("\n⏱️ Training Resolution Time Predictor...")
X_res = df[['category_enc', 'urgency_enc', 'ward_id', 'priority_score', 'sentiment_score']]
y_res = df['resolution_days'].clip(1, 30)
X_tr2, X_te2, y_tr2, y_te2 = train_test_split(X_res, y_res, test_size=0.2, random_state=42)
resolution_model = xgb.XGBRegressor(n_estimators=150, learning_rate=0.08, max_depth=4, random_state=42)
resolution_model.fit(X_tr2, y_tr2)
r2_res = resolution_model.score(X_te2, y_te2)
print(f"✅ Resolution Predictor R²: {r2_res:.3f}")
joblib.dump(resolution_model, 'models/resolution_predictor.joblib')

# Save metadata
metadata = {
    "models": {
        "classifier": {"type": "TF-IDF + LogisticRegression", "accuracy": round(acc, 4), "classes": CATEGORIES},
        "priority_scorer": {"type": "XGBoost Regressor", "r2": round(r2, 4)},
        "resolution_predictor": {"type": "XGBoost Regressor", "r2": round(r2_res, 4)}
    },
    "training_samples": len(df),
    "categories": CATEGORIES,
    "urgencies": URGENCIES
}
with open('models/metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("\n🎉 All models trained and saved to models/")
print(f"   - models/classifier.joblib")
print(f"   - models/priority_scorer.joblib")
print(f"   - models/resolution_predictor.joblib")
