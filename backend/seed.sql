-- =============================================
-- SiliconSahaaya Database Schema + Seed Data
-- =============================================

-- Drop and recreate database
DROP DATABASE IF EXISTS silicon_sahaaya;
CREATE DATABASE silicon_sahaaya;
\c silicon_sahaaya;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ========================
-- TABLES
-- ========================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(15) UNIQUE NOT NULL,
  name VARCHAR(100),
  email VARCHAR(150),
  role VARCHAR(20) DEFAULT 'citizen' CHECK (role IN ('citizen', 'field_officer', 'admin', 'department_head')),
  ward_id INTEGER,
  department_id UUID,
  is_active BOOLEAN DEFAULT true,
  otp VARCHAR(6),
  otp_expires TIMESTAMP,
  fcm_token TEXT,
  avatar_url TEXT,
  language_preference VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  head_name VARCHAR(100),
  head_email VARCHAR(150),
  head_phone VARCHAR(15),
  sla_days INTEGER DEFAULT 7,
  categories TEXT[],
  office_address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  zone VARCHAR(50),
  population INTEGER,
  area_sqkm DECIMAL(8,2),
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  corporation VARCHAR(100) DEFAULT 'BBMP',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'ai_analyzed', 'assigned', 'in_progress', 
    'field_inspection', 'resolved', 'closed', 'reopened', 'escalated'
  )),
  urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  priority_score INTEGER DEFAULT 50,
  ward_id INTEGER REFERENCES wards(id),
  department_id UUID REFERENCES departments(id),
  address TEXT,
  landmark TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  pincode VARCHAR(10),
  duplicate_of UUID REFERENCES complaints(id),
  is_duplicate BOOLEAN DEFAULT false,
  source VARCHAR(30) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'iot', 'api', 'chatbot')),
  language VARCHAR(10) DEFAULT 'en',
  original_description TEXT,
  sentiment_score DECIMAL(4,3),
  sentiment_label VARCHAR(20),
  ml_category VARCHAR(50),
  ml_confidence DECIMAL(5,4),
  predicted_resolution_days INTEGER,
  actual_resolution_days INTEGER,
  resolution_notes TEXT,
  citizen_rating INTEGER CHECK (citizen_rating BETWEEN 1 AND 5),
  citizen_feedback TEXT,
  escalation_level INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  upvote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE TABLE complaint_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(20) DEFAULT 'before' CHECK (image_type IN ('before', 'after', 'evidence')),
  yolo_detections JSONB,
  detected_objects TEXT[],
  confidence_scores JSONB,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE complaint_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id),
  assigned_to UUID REFERENCES users(id),
  department_id UUID REFERENCES departments(id),
  assigned_by UUID REFERENCES users(id),
  assignment_notes TEXT,
  expected_completion DATE,
  actual_completion DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id),
  resolved_by UUID REFERENCES users(id),
  resolution_description TEXT,
  action_taken TEXT,
  before_image_url TEXT,
  after_image_url TEXT,
  resolution_method VARCHAR(50),
  cost_incurred DECIMAL(10,2),
  materials_used TEXT[],
  work_order_number VARCHAR(50),
  verified_by_citizen BOOLEAN DEFAULT false,
  verification_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  complaint_id UUID REFERENCES complaints(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'in_app')),
  title VARCHAR(200),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  metadata JSONB
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email VARCHAR(150),
  to_phone VARCHAR(15),
  subject VARCHAR(200),
  body TEXT,
  type VARCHAR(20) CHECK (type IN ('email', 'sms')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  complaint_id UUID REFERENCES complaints(id),
  sent_by UUID REFERENCES users(id),
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE citizen_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE,
  total_points INTEGER DEFAULT 0,
  complaints_submitted INTEGER DEFAULT 0,
  complaints_resolved INTEGER DEFAULT 0,
  level VARCHAR(30) DEFAULT 'Newcomer',
  rank INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  badge_name VARCHAR(100),
  badge_icon VARCHAR(50),
  description TEXT,
  earned_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ward_hotspots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id INTEGER REFERENCES wards(id),
  category VARCHAR(50),
  complaint_count INTEGER DEFAULT 0,
  hotspot_level VARCHAR(20) DEFAULT 'low' CHECK (hotspot_level IN ('low', 'medium', 'high', 'critical')),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ml_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id),
  model_name VARCHAR(50),
  model_version VARCHAR(20),
  prediction_type VARCHAR(30),
  input_features JSONB,
  output_value JSONB,
  confidence DECIMAL(5,4),
  actual_value JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE complaint_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  status VARCHAR(30),
  description TEXT,
  performed_by UUID REFERENCES users(id),
  role VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE otp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(15),
  otp VARCHAR(6),
  purpose VARCHAR(30) DEFAULT 'login',
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- INDEXES
-- ========================
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_category ON complaints(category);
CREATE INDEX idx_complaints_ward ON complaints(ward_id);
CREATE INDEX idx_complaints_user ON complaints(user_id);
CREATE INDEX idx_complaints_dept ON complaints(department_id);
CREATE INDEX idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX idx_complaints_complaint_id ON complaints(complaint_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- ========================
-- SEED DATA
-- ========================

-- Wards
INSERT INTO wards (name, code, zone, population, area_sqkm, lat, lng) VALUES
('Koramangala', 'KOR-068', 'South', 85000, 7.2, 12.9279, 77.6271),
('Indiranagar', 'IND-081', 'East', 62000, 5.8, 12.9784, 77.6408),
('Whitefield', 'WHT-110', 'East', 145000, 25.3, 12.9698, 77.7499),
('Jayanagar', 'JYN-058', 'South', 78000, 8.1, 12.9300, 77.5825),
('Malleswaram', 'MAL-030', 'West', 92000, 6.5, 13.0060, 77.5700);

-- Departments
INSERT INTO departments (id, name, code, description, head_name, head_email, head_phone, sla_days, categories) VALUES
('d1000000-0000-0000-0000-000000000001', 'Roads & Infrastructure', 'ROADS', 'Manages road maintenance, potholes, and footpaths', 'Suresh Kumar', 'roads@bbmp.gov.in', '9845001001', 7, ARRAY['Roads', 'Potholes', 'Footpath', 'Drainage']),
('d1000000-0000-0000-0000-000000000002', 'Solid Waste Management', 'SWM', 'Handles garbage collection and waste disposal', 'Priya Sharma', 'swm@bbmp.gov.in', '9845001002', 3, ARRAY['Garbage', 'Waste', 'Littering', 'Open Burning']),
('d1000000-0000-0000-0000-000000000003', 'Water Supply & Sewerage', 'BWSSB', 'Manages water supply and sewage systems', 'Ramesh Nair', 'water@bwssb.gov.in', '9845001003', 5, ARRAY['Water', 'Sewage', 'Waterlogging', 'Pipe Leak']),
('d1000000-0000-0000-0000-000000000004', 'Electricity & Streetlights', 'BESCOM', 'Handles power supply and street lighting', 'Kavitha Reddy', 'lights@bescom.gov.in', '9845001004', 2, ARRAY['Streetlight', 'Power', 'Electrical', 'Transformer']),
('d1000000-0000-0000-0000-000000000005', 'Parks & Gardens', 'PARKS', 'Maintains parks, gardens, and public spaces', 'Anand Gowda', 'parks@bbmp.gov.in', '9845001005', 10, ARRAY['Parks', 'Gardens', 'Trees', 'Public Spaces']);

-- Admin User
INSERT INTO users (id, phone, name, email, role) VALUES
('u0000000-0000-0000-0000-000000000001', '9999999999', 'Admin User', 'admin@siliconsahaaya.in', 'admin');

-- Sample Citizens (50 users)
INSERT INTO users (phone, name, email, role) VALUES
('9876543210', 'Rajesh Kumar', 'rajesh@example.com', 'citizen'),
('9876543211', 'Priya Patel', 'priya@example.com', 'citizen'),
('9876543212', 'Suresh Gowda', 'suresh@example.com', 'citizen'),
('9876543213', 'Meena Reddy', 'meena@example.com', 'citizen'),
('9876543214', 'Arun Sharma', 'arun@example.com', 'citizen'),
('9876543215', 'Deepa Nair', 'deepa@example.com', 'citizen'),
('9876543216', 'Vikram Singh', 'vikram@example.com', 'citizen'),
('9876543217', 'Anita Joseph', 'anita@example.com', 'citizen'),
('9876543218', 'Mohan Das', 'mohan@example.com', 'citizen'),
('9876543219', 'Sunita Rao', 'sunita@example.com', 'citizen'),
('9876543220', 'Kiran Kumar', 'kiran@example.com', 'citizen'),
('9876543221', 'Lalitha Devi', 'lalitha@example.com', 'citizen'),
('9876543222', 'Ravi Shankar', 'ravi@example.com', 'citizen'),
('9876543223', 'Usha Kumari', 'usha@example.com', 'citizen'),
('9876543224', 'Ganesh Babu', 'ganesh@example.com', 'citizen'),
('9876543225', 'Kavya Menon', 'kavya@example.com', 'citizen'),
('9876543226', 'Sanjay Gupta', 'sanjay@example.com', 'citizen'),
('9876543227', 'Rekha Nair', 'rekha@example.com', 'citizen'),
('9876543228', 'Harish Patil', 'harish@example.com', 'citizen'),
('9876543229', 'Sneha Iyer', 'sneha@example.com', 'citizen'),
('9876543230', 'Dinesh Kumar', 'dinesh@example.com', 'citizen'),
('9876543231', 'Radha Krishna', 'radha@example.com', 'citizen'),
('9876543232', 'Prakash Rao', 'prakash@example.com', 'citizen'),
('9876543233', 'Savitha Gowda', 'savitha@example.com', 'citizen'),
('9876543234', 'Madhu Sudan', 'madhu@example.com', 'citizen'),
('9876543235', 'Nirmala Devi', 'nirmala@example.com', 'citizen'),
('9876543236', 'Sunil Kumar', 'sunil@example.com', 'citizen'),
('9876543237', 'Geeta Sharma', 'geeta@example.com', 'citizen'),
('9876543238', 'Venkat Rao', 'venkat@example.com', 'citizen'),
('9876543239', 'Shanti Devi', 'shanti@example.com', 'citizen'),
('9876543240', 'Manoj Kumar', 'manoj@example.com', 'citizen'),
('9876543241', 'Pavithra K', 'pavithra@example.com', 'citizen'),
('9876543242', 'Naresh Babu', 'naresh@example.com', 'citizen'),
('9876543243', 'Durga Prasad', 'durga@example.com', 'citizen'),
('9876543244', 'Manjula Devi', 'manjula@example.com', 'citizen'),
('9876543245', 'Ramesh Babu', 'ramesh_b@example.com', 'citizen'),
('9876543246', 'Vidya Sagar', 'vidya@example.com', 'citizen'),
('9876543247', 'Ashok Kumar', 'ashok@example.com', 'citizen'),
('9876543248', 'Pooja Sharma', 'pooja@example.com', 'citizen'),
('9876543249', 'Naveen Gowda', 'naveen@example.com', 'citizen'),
('9876543250', 'Shilpa Rao', 'shilpa@example.com', 'citizen'),
('9876543251', 'Chandru Patil', 'chandru@example.com', 'citizen'),
('9876543252', 'Latha Kumari', 'latha@example.com', 'citizen'),
('9876543253', 'Mahesh Naik', 'mahesh@example.com', 'citizen'),
('9876543254', 'Anusha Reddy', 'anusha@example.com', 'citizen'),
('9876543255', 'Basavaraj K', 'basavaraj@example.com', 'citizen'),
('9876543256', 'Jyothi Nair', 'jyothi@example.com', 'citizen'),
('9876543257', 'Sathish Kumar', 'sathish@example.com', 'citizen'),
('9876543258', 'Mamatha Gowda', 'mamatha@example.com', 'citizen'),
('9876543259', 'Raghu Veer', 'raghu@example.com', 'citizen');

-- Field Officers
INSERT INTO users (phone, name, email, role, department_id, ward_id) VALUES
('9800000001', 'Officer Raju', 'officer.raju@bbmp.gov.in', 'field_officer', 'd1000000-0000-0000-0000-000000000001', 1),
('9800000002', 'Officer Seema', 'officer.seema@bbmp.gov.in', 'field_officer', 'd1000000-0000-0000-0000-000000000002', 2),
('9800000003', 'Officer Praveen', 'officer.praveen@bbmp.gov.in', 'field_officer', 'd1000000-0000-0000-0000-000000000003', 3),
('9800000004', 'Officer Suma', 'officer.suma@bbmp.gov.in', 'field_officer', 'd1000000-0000-0000-0000-000000000004', 4),
('9800000005', 'Officer Krishna', 'officer.krishna@bbmp.gov.in', 'field_officer', 'd1000000-0000-0000-0000-000000000005', 5);

-- Generate 500 realistic complaints using a DO block
DO $$
DECLARE
  v_categories TEXT[] := ARRAY['Roads', 'Garbage', 'Water', 'Streetlight', 'Sewage', 'Parks', 'Noise'];
  v_statuses TEXT[] := ARRAY['submitted', 'ai_analyzed', 'assigned', 'in_progress', 'field_inspection', 'resolved', 'closed'];
  v_urgencies TEXT[] := ARRAY['low', 'medium', 'high', 'critical'];
  v_wards INTEGER[] := ARRAY[1, 2, 3, 4, 5];
  v_dept_map JSONB := '{"Roads": "d1000000-0000-0000-0000-000000000001", "Garbage": "d1000000-0000-0000-0000-000000000002", "Water": "d1000000-0000-0000-0000-000000000003", "Streetlight": "d1000000-0000-0000-0000-000000000004", "Sewage": "d1000000-0000-0000-0000-000000000003", "Parks": "d1000000-0000-0000-0000-000000000005", "Noise": "d1000000-0000-0000-0000-000000000001"}';
  v_titles TEXT[] := ARRAY[
    'Large pothole causing accidents near junction',
    'Garbage overflowing from bin for 3 days',
    'Water pipeline burst flooding road',
    'Streetlight not working for a week',
    'Sewage overflow near residential area',
    'Park benches broken and unusable',
    'Loud construction noise at midnight',
    'Road caved in after heavy rain',
    'Garbage dumped on footpath illegally',
    'Water supply disrupted for 2 days',
    'Multiple streetlights broken in stretch',
    'Sewage smell from open drain',
    'Park trees fallen blocking path',
    'Unauthorized loudspeaker past midnight',
    'Deep crater on main road',
    'Overflowing dustbin near school',
    'Water meter damaged and leaking',
    'Streetlight flickering causing accidents',
    'Sewage pipeline broken on main road',
    'Park swings broken dangerous for children'
  ];
  v_descriptions TEXT[] := ARRAY[
    'The pothole is approximately 2 feet deep and has caused multiple accidents. Immediate repair needed.',
    'The garbage bin has been overflowing for 3 consecutive days causing health hazards and foul smell.',
    'A water pipeline burst yesterday flooding the road and causing traffic issues for commuters.',
    'The streetlight has not been working for over a week causing safety issues for pedestrians at night.',
    'Sewage is overflowing near the residential complex causing extreme unhygienic conditions.',
    'Several park benches have broken and sharp edges are posing danger to visitors especially children.',
    'Loud construction work is happening past midnight violating noise pollution norms.',
    'Heavy rain has caused major road cave-in making the road completely impassable.',
    'Garbage has been illegally dumped on the footpath blocking pedestrian movement.',
    'No water supply for 2 days. Residents are facing severe hardship especially elderly and sick.',
    'Three consecutive streetlights on the stretch are broken making the road very dark at night.',
    'Open drain is emitting foul smell and sewage is overflowing causing health hazards.',
    'Multiple large trees have fallen in the park blocking pathways and posing safety risks.',
    'Neighbors are using unauthorized loudspeakers for events past midnight disturbing residents.',
    'A very deep crater has formed on the main road after rain. Vehicles are getting damaged.'
  ];
  v_i INTEGER;
  v_cat TEXT;
  v_ward INTEGER;
  v_status TEXT;
  v_urgency TEXT;
  v_priority INTEGER;
  v_dept_id TEXT;
  v_lat DECIMAL;
  v_lng DECIMAL;
  v_user_id UUID;
  v_complaint_num VARCHAR;
  v_created_date TIMESTAMP;
  v_resolved_date TIMESTAMP;
  v_title TEXT;
  v_desc TEXT;
  v_rating INTEGER;
BEGIN
  FOR v_i IN 1..500 LOOP
    v_cat := v_categories[1 + floor(random() * 7)::int];
    v_ward := v_wards[1 + floor(random() * 5)::int];
    v_status := v_statuses[1 + floor(random() * 7)::int];
    v_urgency := v_urgencies[1 + floor(random() * 4)::int];
    v_priority := 20 + floor(random() * 80)::int;
    v_dept_id := v_dept_map->>v_cat;
    v_lat := 12.9200 + (random() * 0.1);
    v_lng := 77.5800 + (random() * 0.2);
    v_created_date := NOW() - (random() * interval '90 days');
    v_title := v_titles[1 + floor(random() * 20)::int];
    v_desc := v_descriptions[1 + floor(random() * 15)::int];
    v_rating := CASE WHEN v_status IN ('resolved', 'closed') THEN 1 + floor(random() * 5)::int ELSE NULL END;
    v_resolved_date := CASE WHEN v_status IN ('resolved', 'closed') THEN v_created_date + (random() * interval '14 days') ELSE NULL END;
    v_complaint_num := 'SS-' || EXTRACT(YEAR FROM v_created_date)::TEXT || '-' || LPAD(v_i::TEXT, 6, '0');
    
    SELECT id INTO v_user_id FROM users WHERE role = 'citizen' ORDER BY random() LIMIT 1;
    
    INSERT INTO complaints (
      complaint_id, user_id, title, description, category, status, urgency,
      priority_score, ward_id, department_id, lat, lng,
      address, ml_category, ml_confidence, predicted_resolution_days,
      citizen_rating, created_at, resolved_at, sentiment_score
    ) VALUES (
      v_complaint_num, v_user_id, v_title, v_desc, v_cat, v_status, v_urgency,
      v_priority, v_ward, v_dept_id::UUID, v_lat, v_lng,
      'Near Ward ' || v_ward || ', Bengaluru - 56000' || v_ward,
      v_cat, 0.7 + random() * 0.3, 3 + floor(random() * 10)::int,
      v_rating, v_created_date, v_resolved_date, 
      -1.0 + random() * 2.0
    );
  END LOOP;
END $$;

-- Citizen Points
INSERT INTO citizen_points (user_id, total_points, complaints_submitted, complaints_resolved, level)
SELECT 
  u.id,
  floor(random() * 500)::int as total_points,
  floor(random() * 20)::int as submitted,
  floor(random() * 10)::int as resolved,
  CASE 
    WHEN floor(random() * 500) < 50 THEN 'Newcomer'
    WHEN floor(random() * 500) < 150 THEN 'Active Citizen'
    WHEN floor(random() * 500) < 300 THEN 'Swachhata Warrior'
    ELSE 'Swachhata Champion'
  END as level
FROM users u WHERE u.role = 'citizen';

-- Ward Hotspots
INSERT INTO ward_hotspots (ward_id, category, complaint_count, hotspot_level) VALUES
(1, 'Roads', 45, 'high'),
(1, 'Garbage', 32, 'medium'),
(2, 'Streetlight', 28, 'medium'),
(2, 'Sewage', 41, 'high'),
(3, 'Garbage', 67, 'critical'),
(3, 'Water', 38, 'high'),
(4, 'Roads', 29, 'medium'),
(4, 'Parks', 15, 'low'),
(5, 'Sewage', 53, 'critical'),
(5, 'Garbage', 44, 'high');

-- Resolution Records (for resolved complaints)
INSERT INTO resolutions (complaint_id, resolved_by, resolution_description, action_taken)
SELECT c.id,
  (SELECT id FROM users WHERE role IN ('admin', 'field_officer') ORDER BY random() LIMIT 1),
  'Issue has been resolved by the concerned department.',
  'Field team dispatched and corrective action taken.'
FROM complaints c 
WHERE c.status IN ('resolved', 'closed')
LIMIT 150;

-- Timeline entries
INSERT INTO complaint_timeline (complaint_id, status, description, role)
SELECT id, 'submitted', 'Complaint submitted by citizen', 'citizen' FROM complaints LIMIT 200;

INSERT INTO complaint_timeline (complaint_id, status, description, role)
SELECT id, 'ai_analyzed', 'AI system analyzed and categorized the complaint', 'system' 
FROM complaints WHERE status != 'submitted' LIMIT 180;

INSERT INTO complaint_timeline (complaint_id, status, description, role)
SELECT id, 'assigned', 'Complaint assigned to concerned department', 'admin'
FROM complaints WHERE status NOT IN ('submitted', 'ai_analyzed') LIMIT 160;

-- Badges
INSERT INTO badges (user_id, badge_name, badge_icon, description)
SELECT u.id, 'First Reporter', '🏆', 'Submitted your first complaint'
FROM users u WHERE u.role = 'citizen' ORDER BY random() LIMIT 30;

INSERT INTO badges (user_id, badge_name, badge_icon, description)
SELECT u.id, 'Active Citizen', '⭐', 'Submitted 5 or more complaints'
FROM users u WHERE u.role = 'citizen' ORDER BY random() LIMIT 20;

INSERT INTO badges (user_id, badge_name, badge_icon, description)
SELECT u.id, 'Swachhata Champion', '🎖️', 'Top 10 citizen contributor this month'
FROM users u WHERE u.role = 'citizen' ORDER BY random() LIMIT 10;

-- Update rank in citizen_points
UPDATE citizen_points cp
SET rank = ranks.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC) as rn
  FROM citizen_points
) ranks
WHERE cp.id = ranks.id;

COMMIT;
