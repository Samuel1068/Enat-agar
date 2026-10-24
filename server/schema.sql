-- =============================================================================
-- Enat Agar PostgreSQL Database Schema
-- Antenatal Care (ANC) Maternal & Child Health System
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Patients, Clinicians, Admins)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) UNIQUE NOT NULL,
  id_number VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'patient', -- 'patient', 'clinician', 'admin'
  age VARCHAR(10),
  specialty VARCHAR(100), -- For clinicians (e.g. Midwife, Obstetrician, Health Officer)
  facility_name VARCHAR(150), -- Hospital / Health Center name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patient Profiles (Maternal Clinical & Tracking Data)
CREATE TABLE IF NOT EXISTS patient_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lnmp TIMESTAMP WITH TIME ZONE,
  ga_weeks INTEGER,
  ga_days INTEGER,
  ga_known_date TIMESTAMP WITH TIME ZONE,
  calculation_method VARCHAR(20) DEFAULT 'lnmp', -- 'lnmp' or 'ga'
  blood_type VARCHAR(10),
  rh_factor VARCHAR(10),
  gravida INTEGER DEFAULT 1,
  parity INTEGER DEFAULT 0,
  risk_notes TEXT,
  emergency_contact VARCHAR(100),
  quiz_progress JSONB DEFAULT '{"totalScore": 0, "sectionResults": {}}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Clinician-Patient Assignment Relationships
CREATE TABLE IF NOT EXISTS clinician_patients (
  id SERIAL PRIMARY KEY,
  clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE(clinician_id, patient_id)
);

-- 4. Antenatal Care Appointments and Tracking
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'missed', 'rescheduled'
  missed_reason TEXT,
  marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMP WITH TIME ZONE,
  clinician_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Clinician Reminders and Messages to Patients
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reminder_type VARCHAR(50) DEFAULT 'appointment', -- 'appointment', 'medication', 'warning', 'general'
  due_date TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_clinician_patients_clinician ON clinician_patients(clinician_id);
CREATE INDEX IF NOT EXISTS idx_clinician_patients_patient ON clinician_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON reminders(patient_id);
