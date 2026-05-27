# -*- coding: utf-8 -*-
"""
SiliconSahaaya ML Training Script
Trains: Complaint Classifier, Priority Scorer, Resolution Time Predictor
Generates 20,000 synthetic complaints for training
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

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

# Richer, more varied templates so the classifier learns better features
TEMPLATES = {
    'Roads': [
        "Large pothole on {road} causing accidents and vehicle damage",
        "Road caved in near {area} after heavy rain, completely blocked",
        "Footpath broken and unusable near {landmark}",
        "Speed breaker damaged and dangerous for vehicles on {road}",
        "Road divider broken causing accidents near {area}",
        "Deep crater formed on main road near {landmark}, vehicles swerving dangerously",
        "Potholes on {road} are causing flat tyres and accidents daily",
        "Road surface completely damaged near {area}, urgent repair needed",
        "Broken tar road near {landmark} causing two-wheeler accidents",
        "Massive road cave in near {area} blocking half the lane",
        "Damaged footpath near {landmark} is extremely dangerous for pedestrians",
        "Road construction left incomplete on {road}, no barricades placed",
        "Median divider broken on {road}, vehicles crossing dangerously",
        "Tarmac completely eroded on stretch from {area} to {landmark}",
        "Deep potholes filled with water near {road}, accidents happening daily",
    ],
    'Garbage': [
        "Garbage overflowing from bin near {landmark} for {days} days",
        "Illegal garbage dumping on {road} blocking footpath",
        "Garbage not collected from {area} for past {days} days causing health hazard",
        "Open burning of garbage near {landmark} causing air pollution",
        "Garbage pile near {area} attracting stray animals and insects",
        "Waste not picked up in {area} for a week, foul smell spreading",
        "Huge garbage dump near {landmark} never gets cleared by BBMP",
        "Overflowing trash bins on {road} causing unhygienic conditions",
        "Solid waste accumulated in {area} colony for {days} days",
        "Garbage truck not visiting {area} regularly, waste piling up",
        "Stinking garbage heap near {landmark} causing health problems",
        "Litter and waste scattered all over {road} footpath",
        "Dump yard near {area} is overflowing with uncleared waste",
        "Rubbish piled outside {landmark} not collected for weeks",
        "Garbage disposal site near {area} causing environmental pollution",
        "Faulty garbage bin on {road} spilling waste on the street",
        "Waste management completely failed in {area}, trash everywhere",
        "Municipal workers not collecting garbage from {landmark} area",
        "Stinking garbage smell from {road} due to piled waste",
        "Large pile of garbage blocking pedestrians near {area}",
    ],
    'Water': [
        "No water supply in {area} for past {days} days",
        "Water pipeline burst near {landmark} flooding the road",
        "Stagnant water on {road} causing mosquito breeding",
        "Water meter damaged and leaking near {area}",
        "Contaminated water supply in {area} causing illness",
        "Waterlogging near {landmark} after heavy rain",
        "BWSSB pipeline leaking near {road} wasting water",
        "No drinking water supply in {area} colony for {days} days",
        "Broken water pipe on {road} causing flooding",
        "Water supply cut off completely in {area}",
        "Muddy contaminated water coming from taps in {area}",
        "Flooding due to water main burst near {landmark}",
        "Water shortage crisis in {area} for past week",
        "Pipeline damaged near {road} causing waterlogging",
        "Overhead water tank in {area} not filling properly",
    ],
    'Streetlight': [
        "Streetlight not working on {road} for {days} days causing accidents",
        "Multiple streetlights broken on stretch near {area}",
        "Streetlight wire hanging dangerously near {landmark}",
        "Street light flickering and creating safety hazard on {road}",
        "No street lights on {road} making it dangerous at night",
        "All lamps on {road} are non-functional for weeks",
        "Exposed electric wires from broken lamppost near {landmark}",
        "BESCOM streetlights on {road} have been dark for {days} days",
        "Road completely dark due to non-working lights near {area}",
        "Faulty electricity supply to streetlights on {road}",
        "Light pole fallen down near {landmark}, no one repaired",
        "Lamp not working near {area} bus stand causing accidents at night",
        "Entire street dark due to blown transformer near {road}",
    ],
    'Sewage': [
        "Sewage overflow near {area} creating health hazard",
        "Open drain emitting foul smell near {landmark}",
        "Sewer manhole open and dangerous near {road}",
        "Sewage pipeline broken on {road} causing flooding",
        "Sewage water mixing with drinking water supply in {area}",
        "Drain blocked and overflowing near {landmark}",
        "Stinking sewer water flowing on {road} footpath",
        "Open manhole near {area} is dangerous for pedestrians",
        "BWSSB sewer blocked causing overflow in {area}",
        "Sewage drain clogged near {landmark}, flooding the area",
        "Drain overflowing with sewage near {road} after rain",
        "Blocked drainage causing sewage to spill on {road}",
        "Septic tank overflow near {area} causing health risk",
        "Sewer line choked in {area} colony, residents suffering",
        "Foul smell from drainage near {landmark} unbearable",
    ],
    'Parks': [
        "Park benches broken and dangerous near {landmark}",
        "Tree fallen in {area} park blocking pathways",
        "Park lights not working in {area} creating unsafe conditions",
        "Illegal encroachment on park land near {landmark}",
        "Park swings broken and dangerous for children in {area}",
        "Garden near {area} completely neglected and overgrown",
        "BBMP park in {area} has damaged walking track",
        "Trees not trimmed in {area} park blocking footpaths",
        "Playing equipment in {landmark} park completely broken",
        "Public park near {area} used for illegal dumping",
        "Open ground near {landmark} encroached illegally",
        "Children's park in {area} has sharp broken equipment",
        "Jogging track in {area} park is damaged and waterlogged",
    ],
    'Noise': [
        "Loud construction noise at midnight near {area} disturbing residents",
        "Unauthorized loudspeaker usage near {landmark} past midnight",
        "Industrial noise pollution from factory near {area}",
        "Loud music from bar or restaurant near {landmark} past 10 PM",
        "Constant honking and noise near {road} causing disturbance",
        "DJ sound system near {area} playing loudly till 2 AM",
        "Noise from {area} construction site violating rules",
        "Excessive noise from pub near {landmark} disturbing sleep",
        "Generator running loudly all night near {area}",
        "Factory noise near {road} exceeds permissible limits",
        "Crackers burst continuously near {landmark} causing disturbance",
        "Loud speaker from religious event near {area} all night",
    ]
}

AREAS = ['Koramangala', 'Indiranagar', 'Whitefield', 'Jayanagar', 'Malleswaram',
         'HSR Layout', 'Marathahalli', 'BTM Layout', 'JP Nagar', 'Bannerghatta Road',
         'Rajajinagar', 'Yelahanka', 'Electronic City', 'Hebbal', 'Vijayanagar']
ROADS = ['MG Road', 'Old Airport Road', 'Outer Ring Road', 'Sarjapur Road', 'Hosur Road',
         'Bellary Road', 'Mysore Road', 'Tumkur Road', 'Kanakapura Road', 'Varthur Road']
LANDMARKS = ['near BBMP park', 'behind bus stand', 'opposite school', 'near metro station',
             'beside hospital', 'near market', 'opposite temple', 'near govt office',
             'beside college', 'near petrol pump']

def generate_description(category):
    template = random.choice(TEMPLATES[category])
    return template.format(
        road=random.choice(ROADS),
        area=random.choice(AREAS),
        landmark=random.choice(LANDMARKS),
        days=random.randint(1, 14)
    )

print("Generating 20,000 synthetic training records...")
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
print(f"Generated {len(df)} records")
print(df['category'].value_counts())

# 1. COMPLAINT CLASSIFIER (TF-IDF + Logistic Regression)
print("\nTraining Complaint Classifier...")
X_train, X_test, y_train, y_test = train_test_split(df['description'], df['category'], test_size=0.2, random_state=42)
classifier_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=8000, ngram_range=(1, 2), stop_words='english')),
    ('clf', LogisticRegression(max_iter=1000, C=5.0, random_state=42))
])
classifier_pipeline.fit(X_train, y_train)
y_pred = classifier_pipeline.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"Classifier Accuracy: {acc:.3f}")
print(classification_report(y_test, y_pred))
joblib.dump(classifier_pipeline, 'models/classifier.joblib')

# 2. PRIORITY SCORER (XGBoost)
print("\nTraining Priority Scorer...")
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
print(f"Priority Scorer R2: {r2:.3f}")
joblib.dump(priority_model, 'models/priority_scorer.joblib')
joblib.dump(le_cat, 'models/label_encoder_cat.joblib')
joblib.dump(le_urg, 'models/label_encoder_urg.joblib')

# 3. RESOLUTION TIME PREDICTOR (XGBoost Regressor)
print("\nTraining Resolution Time Predictor...")
X_res = df[['category_enc', 'urgency_enc', 'ward_id', 'priority_score', 'sentiment_score']]
y_res = df['resolution_days'].clip(1, 30)
X_tr2, X_te2, y_tr2, y_te2 = train_test_split(X_res, y_res, test_size=0.2, random_state=42)
resolution_model = xgb.XGBRegressor(n_estimators=150, learning_rate=0.08, max_depth=4, random_state=42)
resolution_model.fit(X_tr2, y_tr2)
r2_res = resolution_model.score(X_te2, y_te2)
print(f"Resolution Predictor R2: {r2_res:.3f}")
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

print("\nAll models trained and saved to models/")
print("   - models/classifier.joblib")
print("   - models/priority_scorer.joblib")
print("   - models/resolution_predictor.joblib")
print("   - models/label_encoder_cat.joblib")
print("   - models/label_encoder_urg.joblib")
