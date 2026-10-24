import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

// Connection string from environment or standard local fallback
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'enatagar'}`;

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : false,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

export let isConnectedToPostgres = false;

// In-Memory store fallback that mirrors PostgreSQL data structure
// Ensures immediate usability even before a user starts their PostgreSQL server
export interface MemoryStore {
  users: any[];
  patient_profiles: any[];
  clinician_patients: any[];
  appointments: any[];
  reminders: any[];
}

export const memoryStore: MemoryStore = {
  users: [],
  patient_profiles: [],
  clinician_patients: [],
  appointments: [],
  reminders: []
};

// Seed initial default accounts
async function seedDefaultAccounts(clientOrMemory: any, isPg: boolean) {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const clinicianPasswordHash = await bcrypt.hash('clinician123', 10);
  const demoPatientPasswordHash = await bcrypt.hash('patient123', 10);

  if (isPg) {
    // 1. Admin
    const adminCheck = await clientOrMemory.query("SELECT id FROM users WHERE phone = '0911000000' OR role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      await clientOrMemory.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role)
        VALUES ('0911000000', 'ADM-001', $1, 'System Administrator', 'admin')
      `, [adminPasswordHash]);
      console.log('✅ [Postgres] Initial Admin account seeded: Phone 0911000000 / Password admin123');
    }

    // 2. Demo Clinician
    const clinicianCheck = await clientOrMemory.query("SELECT id FROM users WHERE phone = '0922000000' LIMIT 1");
    let clinicianId: number;
    if (clinicianCheck.rows.length === 0) {
      const inserted = await clientOrMemory.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role, specialty, facility_name)
        VALUES ('0922000000', 'CLN-001', $1, 'Dr. Selamawit Tadesse', 'clinician', 'Senior Midwife Specialist', 'Tikur Anbessa Hospital')
        RETURNING id
      `, [clinicianPasswordHash]);
      clinicianId = inserted.rows[0].id;
      console.log('✅ [Postgres] Initial Clinician seeded: Phone 0922000000 / Password clinician123');
    } else {
      clinicianId = clinicianCheck.rows[0].id;
    }

    // 3. Demo Patient
    const patientCheck = await clientOrMemory.query("SELECT id FROM users WHERE phone = '0933000000' LIMIT 1");
    if (patientCheck.rows.length === 0) {
      const patientInserted = await clientOrMemory.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role, age)
        VALUES ('0933000000', 'PAT-101', $1, 'Aster Bekele', 'patient', '26')
        RETURNING id
      `, [demoPatientPasswordHash]);
      const patientId = patientInserted.rows[0].id;

      // Calculate sample LNMP (14 weeks ago)
      const sampleLnmp = new Date();
      sampleLnmp.setDate(sampleLnmp.getDate() - 98);

      await clientOrMemory.query(`
        INSERT INTO patient_profiles (user_id, lnmp, calculation_method, blood_type, rh_factor, risk_notes)
        VALUES ($1, $2, 'lnmp', 'O+', '+', 'First-time mother (Primigravida). Doing well.')
      `, [patientId, sampleLnmp.toISOString()]);

      // Assign to Dr. Selamawit
      await clientOrMemory.query(`
        INSERT INTO clinician_patients (clinician_id, patient_id, notes)
        VALUES ($1, $2, 'Initial consultation completed. Routine ANC follow-up.')
        ON CONFLICT DO NOTHING
      `, [clinicianId, patientId]);

      // Seed scheduled ANC visit at week 20
      const apptDate = new Date(sampleLnmp);
      apptDate.setDate(apptDate.getDate() + 140);
      await clientOrMemory.query(`
        INSERT INTO appointments (patient_id, week, appointment_date, description, status)
        VALUES ($1, 20, $2, '20 ሳምንት ወይም 5 ወር ላይ አልትራሳውንድ እና አይረን', 'scheduled')
      `, [patientId, apptDate.toISOString()]);

      // Seed reminder
      await clientOrMemory.query(`
        INSERT INTO reminders (patient_id, clinician_id, title, message, reminder_type)
        VALUES ($1, $2, 'የቀጠሮ ማሳሰቢያ', 'የ20ኛው ሳምንት የአልትራሳውንድ ምርመራ ቀጠሮዎ በቅርቡ ደርሷል፤ እባክዎ በሰዓቱ ይገኙ።', 'appointment')
      `, [patientId, clinicianId]);

      console.log('✅ [Postgres] Demo Patient seeded: Phone 0933000000 / Password patient123');
    }
  } else {
    // Seed in-memory store
    if (memoryStore.users.length === 0) {
      memoryStore.users = [
        {
          id: 1,
          phone: '0911000000',
          id_number: 'ADM-001',
          password_hash: adminPasswordHash,
          name: 'System Administrator',
          role: 'admin',
          created_at: new Date()
        },
        {
          id: 2,
          phone: '0922000000',
          id_number: 'CLN-001',
          password_hash: clinicianPasswordHash,
          name: 'Dr. Selamawit Tadesse',
          role: 'clinician',
          specialty: 'Senior Midwife Specialist',
          facility_name: 'Tikur Anbessa Hospital',
          created_at: new Date()
        },
        {
          id: 3,
          phone: '0933000000',
          id_number: 'PAT-101',
          password_hash: demoPatientPasswordHash,
          name: 'Aster Bekele',
          role: 'patient',
          age: '26',
          created_at: new Date()
        }
      ];

      const sampleLnmp = new Date();
      sampleLnmp.setDate(sampleLnmp.getDate() - 98);

      memoryStore.patient_profiles = [
        {
          id: 1,
          user_id: 3,
          lnmp: sampleLnmp.toISOString(),
          ga_weeks: 14,
          ga_days: 0,
          calculation_method: 'lnmp',
          blood_type: 'O+',
          rh_factor: '+',
          gravida: 1,
          parity: 0,
          risk_notes: 'First-time mother (Primigravida). Doing well.',
          quiz_progress: { totalScore: 10, sectionResults: {} },
          updated_at: new Date()
        }
      ];

      memoryStore.clinician_patients = [
        {
          id: 1,
          clinician_id: 2,
          patient_id: 3,
          assigned_at: new Date(),
          notes: 'Initial consultation completed. Routine ANC follow-up.'
        }
      ];

      const apptDate = new Date(sampleLnmp);
      apptDate.setDate(apptDate.getDate() + 140);

      memoryStore.appointments = [
        {
          id: 1,
          patient_id: 3,
          week: 20,
          appointment_date: apptDate.toISOString(),
          description: '20 ሳምንት ወይም 5 ወር ላይ አልትራሳውንድ እና አይረን',
          status: 'scheduled',
          missed_reason: null,
          clinician_notes: null,
          created_at: new Date()
        }
      ];

      memoryStore.reminders = [
        {
          id: 1,
          patient_id: 3,
          clinician_id: 2,
          title: 'የቀጠሮ ማሳሰቢያ',
          message: 'የ20ኛው ሳምንት የአልትራሳውንድ ምርመራ ቀጠሮዎ በቅርቡ ደርሷል፤ እባክዎ በሰዓቱ ይገኙ።',
          reminder_type: 'appointment',
          is_read: false,
          created_at: new Date()
        }
      ];
      console.log('ℹ️ [Data] Initial In-Memory seed loaded (Admin: 0911000000, Clinician: 0922000000, Patient: 0933000000)');
    }
  }
}

// Initialize tables in PostgreSQL
export async function initDatabase() {
  // Always seed in-memory store first as baseline
  await seedDefaultAccounts(memoryStore, false);

  try {
    const client = await pool.connect();
    console.log('🚀 Connected to PostgreSQL database successfully!');
    isConnectedToPostgres = true;

    // Run table creation DDL
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50) UNIQUE NOT NULL,
        id_number VARCHAR(100),
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'patient',
        age VARCHAR(10),
        specialty VARCHAR(100),
        facility_name VARCHAR(150),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS patient_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lnmp TIMESTAMP WITH TIME ZONE,
        ga_weeks INTEGER,
        ga_days INTEGER,
        ga_known_date TIMESTAMP WITH TIME ZONE,
        calculation_method VARCHAR(20) DEFAULT 'lnmp',
        blood_type VARCHAR(10),
        rh_factor VARCHAR(10),
        gravida INTEGER DEFAULT 1,
        parity INTEGER DEFAULT 0,
        risk_notes TEXT,
        emergency_contact VARCHAR(100),
        quiz_progress JSONB DEFAULT '{"totalScore": 0, "sectionResults": {}}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clinician_patients (
        id SERIAL PRIMARY KEY,
        clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(clinician_id, patient_id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week INTEGER NOT NULL,
        appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'scheduled',
        missed_reason TEXT,
        marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        marked_at TIMESTAMP WITH TIME ZONE,
        clinician_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clinician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        reminder_type VARCHAR(50) DEFAULT 'appointment',
        due_date TIMESTAMP WITH TIME ZONE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed PostgreSQL tables
    await seedDefaultAccounts(client, true);
    client.release();
  } catch (err: any) {
    console.warn('⚠️ Could not connect to local PostgreSQL instance:', err.message);
    console.log('💡 Enat Agar will use the resilient unified data layer with memory sync until PostgreSQL is started.');
    console.log('📌 Configure DATABASE_URL in .env to connect to any PostgreSQL instance (e.g., Supabase, Neon, Docker, or local pg).');
    isConnectedToPostgres = false;
  }
}
