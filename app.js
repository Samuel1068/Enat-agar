// server/index.ts
import express from "express";
import cors from "cors";
import dotenv2 from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// server/db.ts
import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
dotenv.config();
var { Pool } = pg;
var connectionString = process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || "postgres"}:${process.env.PGPASSWORD || "postgres"}@${process.env.PGHOST || "localhost"}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || "enatagar"}`;
var pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" && !connectionString.includes("localhost") ? { rejectUnauthorized: false } : false,
  max: 15,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 3e3
});
pool.on("error", (err) => {
  console.warn("\u26A0\uFE0F [Postgres Pool Background Warning]:", err.message);
});
var isConnectedToPostgres = false;
var memoryStore = {
  users: [],
  patient_profiles: [],
  clinician_patients: [],
  appointments: [],
  reminders: []
};
async function seedDefaultAccounts(clientOrMemory, isPg) {
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const clinicianPasswordHash = await bcrypt.hash("clinician123", 10);
  const demoPatientPasswordHash = await bcrypt.hash("patient123", 10);
  if (isPg) {
    const adminCheck = await clientOrMemory.query("SELECT id FROM users WHERE phone = '0911000000' OR role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      await clientOrMemory.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role)
        VALUES ('0911000000', 'ADM-001', $1, 'System Administrator', 'admin')
      `, [adminPasswordHash]);
      console.log("\u2705 [Postgres] Initial Admin account seeded: Phone 0911000000 / Password admin123");
    }
    const clinicianCheck = await clientOrMemory.query("SELECT id FROM users WHERE phone = '0922000000' LIMIT 1");
    let clinicianId;
    if (clinicianCheck.rows.length === 0) {
      const inserted = await clientOrMemory.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role, specialty, facility_name)
        VALUES ('0922000000', 'CLN-001', $1, 'Dr. Selamawit Tadesse', 'clinician', 'Senior Midwife Specialist', 'Tikur Anbessa Hospital')
        RETURNING id
      `, [clinicianPasswordHash]);
      clinicianId = inserted.rows[0].id;
      console.log("\u2705 [Postgres] Initial Clinician seeded: Phone 0922000000 / Password clinician123");
    } else {
      clinicianId = clinicianCheck.rows[0].id;
    }
    const patientCheck = await clientOrMemory.query("SELECT id FROM users WHERE phone = '0933000000' LIMIT 1");
    if (patientCheck.rows.length === 0) {
      const patientInserted = await clientOrMemory.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role, age)
        VALUES ('0933000000', 'PAT-101', $1, 'Aster Bekele', 'patient', '26')
        RETURNING id
      `, [demoPatientPasswordHash]);
      const patientId = patientInserted.rows[0].id;
      const sampleLnmp = /* @__PURE__ */ new Date();
      sampleLnmp.setDate(sampleLnmp.getDate() - 98);
      await clientOrMemory.query(`
        INSERT INTO patient_profiles (user_id, lnmp, calculation_method, blood_type, rh_factor, risk_notes)
        VALUES ($1, $2, 'lnmp', 'O+', '+', 'First-time mother (Primigravida). Doing well.')
      `, [patientId, sampleLnmp.toISOString()]);
      await clientOrMemory.query(`
        INSERT INTO clinician_patients (clinician_id, patient_id, notes)
        VALUES ($1, $2, 'Initial consultation completed. Routine ANC follow-up.')
        ON CONFLICT DO NOTHING
      `, [clinicianId, patientId]);
      const apptDate = new Date(sampleLnmp);
      apptDate.setDate(apptDate.getDate() + 140);
      await clientOrMemory.query(`
        INSERT INTO appointments (patient_id, week, appointment_date, description, status)
        VALUES ($1, 20, $2, '20 \u1233\u121D\u1295\u1275 \u12C8\u12ED\u121D 5 \u12C8\u122D \u120B\u12ED \u12A0\u120D\u1275\u122B\u1233\u12CD\u1295\u12F5 \u12A5\u1293 \u12A0\u12ED\u1228\u1295', 'scheduled')
      `, [patientId, apptDate.toISOString()]);
      await clientOrMemory.query(`
        INSERT INTO reminders (patient_id, clinician_id, title, message, reminder_type)
        VALUES ($1, $2, '\u12E8\u1240\u1320\u122E \u121B\u1233\u1230\u1262\u12EB', '\u12E820\u129B\u12CD \u1233\u121D\u1295\u1275 \u12E8\u12A0\u120D\u1275\u122B\u1233\u12CD\u1295\u12F5 \u121D\u122D\u1218\u122B \u1240\u1320\u122E\u12CE \u1260\u1245\u122D\u1261 \u12F0\u122D\u1237\u120D\u1364 \u12A5\u1263\u12AD\u12CE \u1260\u1230\u12D3\u1271 \u12ED\u1308\u1299\u1362', 'appointment')
      `, [patientId, clinicianId]);
      console.log("\u2705 [Postgres] Demo Patient seeded: Phone 0933000000 / Password patient123");
    }
  } else {
    if (memoryStore.users.length === 0) {
      memoryStore.users = [
        {
          id: 1,
          phone: "0911000000",
          id_number: "ADM-001",
          password_hash: adminPasswordHash,
          name: "System Administrator",
          role: "admin",
          created_at: /* @__PURE__ */ new Date()
        },
        {
          id: 2,
          phone: "0922000000",
          id_number: "CLN-001",
          password_hash: clinicianPasswordHash,
          name: "Dr. Selamawit Tadesse",
          role: "clinician",
          specialty: "Senior Midwife Specialist",
          facility_name: "Tikur Anbessa Hospital",
          created_at: /* @__PURE__ */ new Date()
        },
        {
          id: 3,
          phone: "0933000000",
          id_number: "PAT-101",
          password_hash: demoPatientPasswordHash,
          name: "Aster Bekele",
          role: "patient",
          age: "26",
          created_at: /* @__PURE__ */ new Date()
        }
      ];
      const sampleLnmp = /* @__PURE__ */ new Date();
      sampleLnmp.setDate(sampleLnmp.getDate() - 98);
      memoryStore.patient_profiles = [
        {
          id: 1,
          user_id: 3,
          lnmp: sampleLnmp.toISOString(),
          ga_weeks: 14,
          ga_days: 0,
          calculation_method: "lnmp",
          blood_type: "O+",
          rh_factor: "+",
          gravida: 1,
          parity: 0,
          risk_notes: "First-time mother (Primigravida). Doing well.",
          quiz_progress: { totalScore: 10, sectionResults: {} },
          updated_at: /* @__PURE__ */ new Date()
        }
      ];
      memoryStore.clinician_patients = [
        {
          id: 1,
          clinician_id: 2,
          patient_id: 3,
          assigned_at: /* @__PURE__ */ new Date(),
          notes: "Initial consultation completed. Routine ANC follow-up."
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
          description: "20 \u1233\u121D\u1295\u1275 \u12C8\u12ED\u121D 5 \u12C8\u122D \u120B\u12ED \u12A0\u120D\u1275\u122B\u1233\u12CD\u1295\u12F5 \u12A5\u1293 \u12A0\u12ED\u1228\u1295",
          status: "scheduled",
          missed_reason: null,
          clinician_notes: null,
          created_at: /* @__PURE__ */ new Date()
        }
      ];
      memoryStore.reminders = [
        {
          id: 1,
          patient_id: 3,
          clinician_id: 2,
          title: "\u12E8\u1240\u1320\u122E \u121B\u1233\u1230\u1262\u12EB",
          message: "\u12E820\u129B\u12CD \u1233\u121D\u1295\u1275 \u12E8\u12A0\u120D\u1275\u122B\u1233\u12CD\u1295\u12F5 \u121D\u122D\u1218\u122B \u1240\u1320\u122E\u12CE \u1260\u1245\u122D\u1261 \u12F0\u122D\u1237\u120D\u1364 \u12A5\u1263\u12AD\u12CE \u1260\u1230\u12D3\u1271 \u12ED\u1308\u1299\u1362",
          reminder_type: "appointment",
          is_read: false,
          created_at: /* @__PURE__ */ new Date()
        }
      ];
      console.log("\u2139\uFE0F [Data] Initial In-Memory seed loaded (Admin: 0911000000, Clinician: 0922000000, Patient: 0933000000)");
    }
  }
}
async function initDatabase() {
  await seedDefaultAccounts(memoryStore, false);
  try {
    const client = await pool.connect();
    console.log("\u{1F680} Connected to PostgreSQL database successfully!");
    isConnectedToPostgres = true;
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
    await seedDefaultAccounts(client, true);
    client.release();
  } catch (err) {
    console.warn("\u26A0\uFE0F Could not connect to local PostgreSQL instance:", err.message);
    console.log("\u{1F4A1} Enat Agar will use the resilient unified data layer with memory sync until PostgreSQL is started.");
    console.log("\u{1F4CC} Configure DATABASE_URL in .env to connect to any PostgreSQL instance (e.g., Supabase, Neon, Docker, or local pg).");
    isConnectedToPostgres = false;
  }
}

// server/routes/auth.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// server/utils/jwt.ts
import crypto from "node:crypto";
function base64UrlEncode(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}
function signJwt(payload, secret, expiresInSeconds = 30 * 24 * 3600) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${signature}`;
}
function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  if (signature !== expectedSignature) {
    throw new Error("Invalid signature");
  }
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("Token has expired");
  }
  return payload;
}

// server/dataService.ts
var dataService = {
  // --- USERS ---
  async getUserByPhone(phone) {
    if (isConnectedToPostgres) {
      const res = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
      return res.rows[0] || null;
    }
    return memoryStore.users.find((u) => u.phone === phone) || null;
  },
  async getUserById(id) {
    if (isConnectedToPostgres) {
      const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
      return res.rows[0] || null;
    }
    return memoryStore.users.find((u) => u.id === id) || null;
  },
  async createUser(userData) {
    const role = userData.role || "patient";
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        INSERT INTO users (phone, id_number, password_hash, name, role, age, specialty, facility_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        userData.phone,
        userData.id_number || null,
        userData.password_hash,
        userData.name,
        role,
        userData.age || null,
        userData.specialty || null,
        userData.facility_name || null
      ]);
      return res.rows[0];
    }
    const newId = memoryStore.users.length > 0 ? Math.max(...memoryStore.users.map((u) => u.id)) + 1 : 1;
    const user = {
      id: newId,
      phone: userData.phone,
      id_number: userData.id_number || null,
      password_hash: userData.password_hash,
      name: userData.name,
      role,
      age: userData.age || null,
      specialty: userData.specialty || null,
      facility_name: userData.facility_name || null,
      created_at: /* @__PURE__ */ new Date()
    };
    memoryStore.users.push(user);
    return user;
  },
  // --- PATIENT PROFILES ---
  async getPatientProfile(userId) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT p.*, u.name, u.phone, u.age, u.id_number
        FROM patient_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = $1
      `, [userId]);
      return res.rows[0] || null;
    }
    const profile = memoryStore.patient_profiles.find((p) => p.user_id === userId);
    if (!profile) return null;
    const user = memoryStore.users.find((u) => u.id === userId);
    return { ...profile, name: user?.name, phone: user?.phone, age: user?.age, id_number: user?.id_number };
  },
  async upsertPatientProfile(userId, profileData) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        INSERT INTO patient_profiles (user_id, lnmp, ga_weeks, ga_days, ga_known_date, calculation_method, blood_type, rh_factor, risk_notes, emergency_contact, quiz_progress, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          lnmp = COALESCE(EXCLUDED.lnmp, patient_profiles.lnmp),
          ga_weeks = COALESCE(EXCLUDED.ga_weeks, patient_profiles.ga_weeks),
          ga_days = COALESCE(EXCLUDED.ga_days, patient_profiles.ga_days),
          ga_known_date = COALESCE(EXCLUDED.ga_known_date, patient_profiles.ga_known_date),
          calculation_method = COALESCE(EXCLUDED.calculation_method, patient_profiles.calculation_method),
          blood_type = COALESCE(EXCLUDED.blood_type, patient_profiles.blood_type),
          rh_factor = COALESCE(EXCLUDED.rh_factor, patient_profiles.rh_factor),
          risk_notes = COALESCE(EXCLUDED.risk_notes, patient_profiles.risk_notes),
          emergency_contact = COALESCE(EXCLUDED.emergency_contact, patient_profiles.emergency_contact),
          quiz_progress = COALESCE(EXCLUDED.quiz_progress, patient_profiles.quiz_progress),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        userId,
        profileData.lnmp || null,
        profileData.ga_weeks ?? null,
        profileData.ga_days ?? null,
        profileData.ga_known_date || null,
        profileData.calculation_method || "lnmp",
        profileData.blood_type || null,
        profileData.rh_factor || null,
        profileData.risk_notes || null,
        profileData.emergency_contact || null,
        profileData.quiz_progress ? JSON.stringify(profileData.quiz_progress) : "{}"
      ]);
      return res.rows[0];
    }
    let existing = memoryStore.patient_profiles.find((p) => p.user_id === userId);
    if (!existing) {
      const newId = memoryStore.patient_profiles.length > 0 ? Math.max(...memoryStore.patient_profiles.map((p) => p.id)) + 1 : 1;
      existing = {
        id: newId,
        user_id: userId,
        calculation_method: "lnmp",
        updated_at: /* @__PURE__ */ new Date()
      };
      memoryStore.patient_profiles.push(existing);
    }
    Object.assign(existing, profileData, { updated_at: /* @__PURE__ */ new Date() });
    return existing;
  },
  // --- CLINICIAN - PATIENT ASSIGNMENTS ---
  async getClinicianPatients(clinicianId) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT u.id, u.name, u.phone, u.age, u.id_number,
               p.lnmp, p.ga_weeks, p.ga_days, p.ga_known_date, p.calculation_method,
               p.blood_type, p.rh_factor, p.risk_notes,
               cp.assigned_at, cp.notes as assignment_notes
        FROM clinician_patients cp
        JOIN users u ON u.id = cp.patient_id
        LEFT JOIN patient_profiles p ON p.user_id = u.id
        WHERE cp.clinician_id = $1
        ORDER BY cp.assigned_at DESC
      `, [clinicianId]);
      return res.rows;
    }
    const assignments = memoryStore.clinician_patients.filter((cp) => cp.clinician_id === clinicianId);
    return assignments.map((cp) => {
      const u = memoryStore.users.find((user) => user.id === cp.patient_id);
      const p = memoryStore.patient_profiles.find((prof) => prof.user_id === cp.patient_id);
      return {
        id: u?.id,
        name: u?.name,
        phone: u?.phone,
        age: u?.age,
        id_number: u?.id_number,
        lnmp: p?.lnmp,
        ga_weeks: p?.ga_weeks,
        ga_days: p?.ga_days,
        ga_known_date: p?.ga_known_date,
        calculation_method: p?.calculation_method,
        blood_type: p?.blood_type,
        rh_factor: p?.rh_factor,
        risk_notes: p?.risk_notes,
        assigned_at: cp.assigned_at,
        assignment_notes: cp.notes
      };
    });
  },
  async assignPatientToClinician(clinicianId, patientId, notes) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        INSERT INTO clinician_patients (clinician_id, patient_id, notes)
        VALUES ($1, $2, $3)
        ON CONFLICT (clinician_id, patient_id) DO UPDATE SET notes = EXCLUDED.notes
        RETURNING *
      `, [clinicianId, patientId, notes || null]);
      return res.rows[0];
    }
    const existing = memoryStore.clinician_patients.find(
      (cp) => cp.clinician_id === clinicianId && cp.patient_id === patientId
    );
    if (existing) {
      existing.notes = notes || existing.notes;
      return existing;
    }
    const newId = memoryStore.clinician_patients.length > 0 ? Math.max(...memoryStore.clinician_patients.map((cp) => cp.id)) + 1 : 1;
    const assignment = {
      id: newId,
      clinician_id: clinicianId,
      patient_id: patientId,
      assigned_at: /* @__PURE__ */ new Date(),
      notes: notes || null
    };
    memoryStore.clinician_patients.push(assignment);
    return assignment;
  },
  // --- APPOINTMENTS ---
  async getPatientAppointments(patientId) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT a.*, u.name as marked_by_name
        FROM appointments a
        LEFT JOIN users u ON u.id = a.marked_by
        WHERE a.patient_id = $1
        ORDER BY a.appointment_date ASC
      `, [patientId]);
      return res.rows;
    }
    return memoryStore.appointments.filter((a) => a.patient_id === patientId).map((a) => {
      const marker = memoryStore.users.find((u) => u.id === a.marked_by);
      return { ...a, marked_by_name: marker?.name };
    });
  },
  async upsertAppointment(data) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        INSERT INTO appointments (patient_id, week, appointment_date, description, status, missed_reason, clinician_notes, marked_by, marked_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        data.patient_id,
        data.week,
        data.appointment_date,
        data.description,
        data.status || "scheduled",
        data.missed_reason || null,
        data.clinician_notes || null,
        data.marked_by || null
      ]);
      return res.rows[0];
    }
    const newId = memoryStore.appointments.length > 0 ? Math.max(...memoryStore.appointments.map((a) => a.id)) + 1 : 1;
    const appt = {
      id: newId,
      patient_id: data.patient_id,
      week: data.week,
      appointment_date: data.appointment_date,
      description: data.description,
      status: data.status || "scheduled",
      missed_reason: data.missed_reason || null,
      clinician_notes: data.clinician_notes || null,
      marked_by: data.marked_by || null,
      marked_at: /* @__PURE__ */ new Date(),
      created_at: /* @__PURE__ */ new Date()
    };
    memoryStore.appointments.push(appt);
    return appt;
  },
  async updateAppointmentStatus(appointmentId, status, missedReason, notes, markedBy) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        UPDATE appointments
        SET status = $1, missed_reason = $2, clinician_notes = $3, marked_by = $4, marked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [status, missedReason || null, notes || null, markedBy || null, appointmentId]);
      return res.rows[0];
    }
    const appt = memoryStore.appointments.find((a) => a.id === appointmentId);
    if (appt) {
      appt.status = status;
      appt.missed_reason = missedReason || null;
      appt.clinician_notes = notes || null;
      appt.marked_by = markedBy || null;
      appt.marked_at = /* @__PURE__ */ new Date();
    }
    return appt;
  },
  // --- REMINDERS ---
  async getPatientReminders(patientId) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT r.*, u.name as clinician_name
        FROM reminders r
        LEFT JOIN users u ON u.id = r.clinician_id
        WHERE r.patient_id = $1
        ORDER BY r.created_at DESC
      `, [patientId]);
      return res.rows;
    }
    return memoryStore.reminders.filter((r) => r.patient_id === patientId).map((r) => {
      const clinician = memoryStore.users.find((u) => u.id === r.clinician_id);
      return { ...r, clinician_name: clinician?.name };
    });
  },
  async createReminder(data) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        INSERT INTO reminders (patient_id, clinician_id, title, message, reminder_type, due_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        data.patient_id,
        data.clinician_id || null,
        data.title,
        data.message,
        data.reminder_type || "appointment",
        data.due_date || null
      ]);
      return res.rows[0];
    }
    const newId = memoryStore.reminders.length > 0 ? Math.max(...memoryStore.reminders.map((r) => r.id)) + 1 : 1;
    const reminder = {
      id: newId,
      patient_id: data.patient_id,
      clinician_id: data.clinician_id || null,
      title: data.title,
      message: data.message,
      reminder_type: data.reminder_type || "appointment",
      due_date: data.due_date || null,
      is_read: false,
      created_at: /* @__PURE__ */ new Date()
    };
    memoryStore.reminders.push(reminder);
    return reminder;
  },
  // --- ADMIN QUERIES ---
  async getAllPatients() {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT u.id, u.name, u.phone, u.age, u.id_number, u.created_at,
               p.lnmp, p.ga_weeks, p.ga_days, p.ga_known_date, p.calculation_method,
               p.blood_type, p.rh_factor, p.risk_notes,
               COALESCE(json_agg(
                 json_build_object('id', c.id, 'name', c.name, 'facility', c.facility_name)
               ) FILTER (WHERE c.id IS NOT NULL), '[]') as clinicians
        FROM users u
        LEFT JOIN patient_profiles p ON p.user_id = u.id
        LEFT JOIN clinician_patients cp ON cp.patient_id = u.id
        LEFT JOIN users c ON c.id = cp.clinician_id
        WHERE u.role = 'patient'
        GROUP BY u.id, p.id
        ORDER BY u.created_at DESC
      `);
      return res.rows;
    }
    const patients = memoryStore.users.filter((u) => u.role === "patient");
    return patients.map((u) => {
      const p = memoryStore.patient_profiles.find((prof) => prof.user_id === u.id);
      const assignments = memoryStore.clinician_patients.filter((cp) => cp.patient_id === u.id);
      const clinicians = assignments.map((cp) => {
        const c = memoryStore.users.find((user) => user.id === cp.clinician_id);
        return { id: c?.id, name: c?.name, facility: c?.facility_name };
      });
      return {
        id: u.id,
        name: u.name,
        phone: u.phone,
        age: u.age,
        id_number: u.id_number,
        created_at: u.created_at,
        lnmp: p?.lnmp,
        ga_weeks: p?.ga_weeks,
        ga_days: p?.ga_days,
        ga_known_date: p?.ga_known_date,
        calculation_method: p?.calculation_method,
        blood_type: p?.blood_type,
        rh_factor: p?.rh_factor,
        risk_notes: p?.risk_notes,
        clinicians
      };
    });
  },
  async getAllCliniciansWithPatients() {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT c.id, c.name, c.phone, c.specialty, c.facility_name, c.created_at,
               COUNT(cp.patient_id) as patient_count,
               COALESCE(json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'phone', p.phone,
                   'age', p.age
                 )
               ) FILTER (WHERE p.id IS NOT NULL), '[]') as patients
        FROM users c
        LEFT JOIN clinician_patients cp ON cp.clinician_id = c.id
        LEFT JOIN users p ON p.id = cp.patient_id
        WHERE c.role = 'clinician'
        GROUP BY c.id
        ORDER BY c.name ASC
      `);
      return res.rows;
    }
    const clinicians = memoryStore.users.filter((u) => u.role === "clinician");
    return clinicians.map((c) => {
      const assignments = memoryStore.clinician_patients.filter((cp) => cp.clinician_id === c.id);
      const patients = assignments.map((cp) => {
        const pat = memoryStore.users.find((u) => u.id === cp.patient_id);
        return { id: pat?.id, name: pat?.name, phone: pat?.phone, age: pat?.age };
      });
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        specialty: c.specialty,
        facility_name: c.facility_name,
        created_at: c.created_at,
        patient_count: patients.length,
        patients
      };
    });
  },
  async getAdminStats() {
    if (isConnectedToPostgres) {
      const totalPatients = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'patient'");
      const totalClinicians = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'clinician'");
      const missedAppointments = await pool.query("SELECT COUNT(*) FROM appointments WHERE status = 'missed'");
      const scheduledAppointments = await pool.query("SELECT COUNT(*) FROM appointments WHERE status = 'scheduled'");
      return {
        totalPatients: parseInt(totalPatients.rows[0].count, 10),
        totalClinicians: parseInt(totalClinicians.rows[0].count, 10),
        missedAppointments: parseInt(missedAppointments.rows[0].count, 10),
        scheduledAppointments: parseInt(scheduledAppointments.rows[0].count, 10)
      };
    }
    return {
      totalPatients: memoryStore.users.filter((u) => u.role === "patient").length,
      totalClinicians: memoryStore.users.filter((u) => u.role === "clinician").length,
      missedAppointments: memoryStore.appointments.filter((a) => a.status === "missed").length,
      scheduledAppointments: memoryStore.appointments.filter((a) => a.status === "scheduled").length
    };
  }
};

// server/middleware/auth.ts
var JWT_SECRET = process.env.JWT_SECRET || "enatagar_secret_maternal_jwt_2025_secure";
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Access token required. Please log in." });
    return;
  }
  try {
    const decoded = verifyJwt(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired token." });
    return;
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of the following roles: ${roles.join(", ")}`
      });
      return;
    }
    next();
  };
}

// server/routes/auth.ts
var router = Router();
router.post("/register", async (req, res) => {
  try {
    const { phone, id_number, password, name, role, age, specialty, facility_name } = req.body;
    if (!phone || !password || !name) {
      res.status(400).json({ error: "\u1235\u120D\u12AD \u1241\u1325\u122D\u1363 \u1235\u121D \u12A5\u1293 \u12E8\u12ED\u1208\u134D \u1243\u120D \u12EB\u1235\u1348\u120D\u130B\u120D (Phone, name, and password are required)." });
      return;
    }
    const cleanPhone = phone.trim();
    const existing = await dataService.getUserByPhone(cleanPhone);
    if (existing) {
      res.status(400).json({ error: "\u12ED\u1205 \u1235\u120D\u12AD \u1241\u1325\u122D \u1240\u12F5\u121E\u12CD\u1291 \u1270\u1218\u12DD\u130D\u1267\u120D (This phone number is already registered)." });
      return;
    }
    const password_hash = await bcrypt2.hash(password, 10);
    const userRole = role === "clinician" ? "clinician" : "patient";
    const user = await dataService.createUser({
      phone: cleanPhone,
      id_number: id_number ? id_number.trim() : void 0,
      password_hash,
      name: name.trim(),
      role: userRole,
      age,
      specialty,
      facility_name
    });
    if (userRole === "patient") {
      await dataService.upsertPatientProfile(user.id, {
        calculation_method: "lnmp"
      });
    }
    const token = signJwt(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET
    );
    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        phone: user.phone,
        id_number: user.id_number,
        name: user.name,
        role: user.role,
        age: user.age,
        specialty: user.specialty,
        facility_name: user.facility_name
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "\u12E8\u121D\u12DD\u1308\u1263 \u1235\u1205\u1270\u1275 \u12A0\u130B\u1325\u121F\u120D (Server error during registration)" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ error: "\u12A5\u1263\u12AD\u12CE \u1235\u120D\u12AD \u1241\u1325\u122D \u12A5\u1293 \u12E8\u12ED\u1208\u134D \u1243\u120D \u12EB\u1235\u1308\u1261 (Phone and password required)." });
      return;
    }
    const cleanPhone = phone.trim();
    const user = await dataService.getUserByPhone(cleanPhone);
    if (!user) {
      res.status(401).json({ error: "\u1235\u120D\u12AD \u1241\u1325\u122D \u12C8\u12ED\u121D \u12E8\u12ED\u1208\u134D \u1243\u120D \u12E8\u1270\u1233\u1233\u1270 \u1290\u12CD (Invalid phone or password)." });
      return;
    }
    const isMatch = await bcrypt2.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: "\u1235\u120D\u12AD \u1241\u1325\u122D \u12C8\u12ED\u121D \u12E8\u12ED\u1208\u134D \u1243\u120D \u12E8\u1270\u1233\u1233\u1270 \u1290\u12CD (Invalid phone or password)." });
      return;
    }
    const token = signJwt(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET
    );
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        phone: user.phone,
        id_number: user.id_number,
        name: user.name,
        role: user.role,
        age: user.age,
        specialty: user.specialty,
        facility_name: user.facility_name
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "\u12E8\u1218\u130D\u1262\u12EB \u1235\u1205\u1270\u1275 \u12A0\u130B\u1325\u121F\u120D (Server error during login)" });
  }
});
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await dataService.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    let profile = null;
    if (user.role === "patient") {
      profile = await dataService.getPatientProfile(user.id);
    }
    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        id_number: user.id_number,
        name: user.name,
        role: user.role,
        age: user.age,
        specialty: user.specialty,
        facility_name: user.facility_name
      },
      profile
    });
  } catch (err) {
    console.error("Auth /me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
var auth_default = router;

// server/routes/patients.ts
import { Router as Router2 } from "express";
var router2 = Router2();
router2.get("/me", authenticateToken, requireRole("patient"), async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await dataService.getPatientProfile(userId);
    const appointments = await dataService.getPatientAppointments(userId);
    const reminders = await dataService.getPatientReminders(userId);
    res.json({
      profile,
      appointments,
      reminders
    });
  } catch (err) {
    console.error("Fetch patient profile error:", err);
    res.status(500).json({ error: "Failed to retrieve patient profile" });
  }
});
router2.put("/me", authenticateToken, requireRole("patient"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { lnmp, ga_weeks, ga_days, ga_known_date, calculation_method, blood_type, rh_factor, risk_notes, quiz_progress } = req.body;
    const updatedProfile = await dataService.upsertPatientProfile(userId, {
      lnmp,
      ga_weeks,
      ga_days,
      ga_known_date,
      calculation_method,
      blood_type,
      rh_factor,
      risk_notes,
      quiz_progress
    });
    res.json({
      message: "Patient profile synced successfully",
      profile: updatedProfile
    });
  } catch (err) {
    console.error("Update patient profile error:", err);
    res.status(500).json({ error: "Failed to update patient profile" });
  }
});
router2.get("/reminders", authenticateToken, requireRole("patient"), async (req, res) => {
  try {
    const reminders = await dataService.getPatientReminders(req.user.id);
    res.json({ reminders });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});
var patients_default = router2;

// server/routes/clinicians.ts
import { Router as Router3 } from "express";
import bcrypt3 from "bcryptjs";
var router3 = Router3();
router3.use(authenticateToken);
router3.use(requireRole("clinician", "admin"));
router3.get("/patients", async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const patients = await dataService.getClinicianPatients(clinicianId);
    res.json({ patients });
  } catch (err) {
    console.error("Clinician list patients error:", err);
    res.status(500).json({ error: "Failed to retrieve patient list" });
  }
});
router3.post("/patients/add-by-credentials", async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const { phone, password, notes } = req.body;
    if (!phone || !password) {
      res.status(400).json({ error: "\u12E8\u1273\u12AB\u121A\u12CD\u1295 \u1235\u120D\u12AD \u1241\u1325\u122D \u12A5\u1293 \u12E8\u12ED\u1208\u134D \u1243\u120D \u12EB\u1235\u1308\u1261 (Patient phone and password are required)." });
      return;
    }
    const cleanPhone = phone.trim();
    const patientUser = await dataService.getUserByPhone(cleanPhone);
    if (!patientUser) {
      res.status(404).json({ error: "\u1260\u12DA\u1205 \u1235\u120D\u12AD \u1241\u1325\u122D \u12E8\u1270\u1218\u12D8\u1308\u1260 \u1273\u12AB\u121A \u12A0\u120D\u1270\u1308\u1298\u121D (No patient found with this phone number)." });
      return;
    }
    if (patientUser.role !== "patient") {
      res.status(400).json({ error: "\u12ED\u1205 \u12A0\u12AB\u12CD\u1295\u1275 \u12E8\u1273\u12AB\u121A \u12A0\u12ED\u12F0\u1208\u121D (This account is not a patient)." });
      return;
    }
    const isMatch = await bcrypt3.compare(password, patientUser.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: "\u12E8\u1273\u12AB\u121A\u12CD \u12E8\u12ED\u1208\u134D \u1243\u120D \u12E8\u1270\u1233\u1233\u1270 \u1290\u12CD (Invalid patient password. Patient consent authorization failed)." });
      return;
    }
    const assignment = await dataService.assignPatientToClinician(clinicianId, patientUser.id, notes);
    const profile = await dataService.getPatientProfile(patientUser.id);
    res.json({
      message: "\u1273\u12AB\u121A\u12CD \u1260\u1270\u1233\u12AB \u1201\u1294\u1273 \u12C8\u12F0 \u12DD\u122D\u12DD\u122D\u12CE \u1270\u12AB\u1277\u120D (Patient successfully linked to your care list)",
      patient: {
        id: patientUser.id,
        name: patientUser.name,
        phone: patientUser.phone,
        age: patientUser.age,
        id_number: patientUser.id_number,
        profile,
        assigned_at: assignment.assigned_at
      }
    });
  } catch (err) {
    console.error("Add patient by credentials error:", err);
    res.status(500).json({ error: "Failed to link patient" });
  }
});
router3.post("/patients/register-new", async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const { phone, name, age, id_number, password, lnmp, ga_weeks, ga_days, ga_known_date, calculation_method, blood_type, rh_factor, risk_notes, notes } = req.body;
    if (!phone || !name) {
      res.status(400).json({ error: "\u1235\u120D\u12AD \u1241\u1325\u122D \u12A5\u1293 \u1235\u121D \u12EB\u1235\u1348\u120D\u130B\u120D (Phone and name are required)" });
      return;
    }
    const cleanPhone = phone.trim();
    const existing = await dataService.getUserByPhone(cleanPhone);
    if (existing) {
      res.status(400).json({ error: "\u12ED\u1205 \u1235\u120D\u12AD \u1241\u1325\u122D \u1240\u12F5\u121E\u12CD\u1291 \u1270\u1218\u12DD\u130D\u1267\u120D (Phone number is already registered)" });
      return;
    }
    const rawPassword = password || "patient123";
    const password_hash = await bcrypt3.hash(rawPassword, 10);
    const newUser = await dataService.createUser({
      phone: cleanPhone,
      id_number: id_number ? id_number.trim() : void 0,
      password_hash,
      name: name.trim(),
      role: "patient",
      age
    });
    await dataService.upsertPatientProfile(newUser.id, {
      lnmp,
      ga_weeks: ga_weeks ? parseInt(ga_weeks, 10) : void 0,
      ga_days: ga_days ? parseInt(ga_days, 10) : void 0,
      ga_known_date,
      calculation_method: calculation_method || "lnmp",
      blood_type,
      rh_factor,
      risk_notes
    });
    await dataService.assignPatientToClinician(clinicianId, newUser.id, notes || "Registered by clinician");
    res.status(201).json({
      message: "New patient registered and assigned successfully",
      patient: {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        age: newUser.age,
        id_number: newUser.id_number,
        tempPassword: rawPassword
      }
    });
  } catch (err) {
    console.error("Clinician register patient error:", err);
    res.status(500).json({ error: "Failed to register patient" });
  }
});
router3.get("/patients/:id", async (req, res) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const profile = await dataService.getPatientProfile(patientId);
    if (!profile) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const appointments = await dataService.getPatientAppointments(patientId);
    const reminders = await dataService.getPatientReminders(patientId);
    res.json({
      patient: profile,
      appointments,
      reminders
    });
  } catch (err) {
    console.error("Get patient details error:", err);
    res.status(500).json({ error: "Failed to retrieve patient details" });
  }
});
router3.put("/patients/:id", async (req, res) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const { lnmp, ga_weeks, ga_days, ga_known_date, calculation_method, blood_type, rh_factor, risk_notes, notes } = req.body;
    const updatedProfile = await dataService.upsertPatientProfile(patientId, {
      lnmp,
      ga_weeks: ga_weeks !== void 0 ? parseInt(ga_weeks, 10) : void 0,
      ga_days: ga_days !== void 0 ? parseInt(ga_days, 10) : void 0,
      ga_known_date,
      calculation_method,
      blood_type,
      rh_factor,
      risk_notes
    });
    if (notes) {
      await dataService.assignPatientToClinician(req.user.id, patientId, notes);
    }
    res.json({
      message: "Patient profile updated successfully",
      profile: updatedProfile
    });
  } catch (err) {
    console.error("Update patient profile error:", err);
    res.status(500).json({ error: "Failed to update patient profile" });
  }
});
router3.post("/patients/:id/appointment-status", async (req, res) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const clinicianId = req.user.id;
    const { appointmentId, week, appointmentDate, description, status, missedReason, notes } = req.body;
    if (!status) {
      res.status(400).json({ error: "Status is required (e.g., missed, completed, scheduled)" });
      return;
    }
    let appointment;
    if (appointmentId) {
      appointment = await dataService.updateAppointmentStatus(
        parseInt(appointmentId, 10),
        status,
        missedReason,
        notes,
        clinicianId
      );
    } else {
      appointment = await dataService.upsertAppointment({
        patient_id: patientId,
        week: week || 0,
        appointment_date: appointmentDate || (/* @__PURE__ */ new Date()).toISOString(),
        description: description || `ANC Visit Status (${status})`,
        status,
        missed_reason: missedReason,
        clinician_notes: notes,
        marked_by: clinicianId
      });
    }
    res.json({
      message: `Appointment updated to: ${status}`,
      appointment
    });
  } catch (err) {
    console.error("Update appointment status error:", err);
    res.status(500).json({ error: "Failed to update appointment status" });
  }
});
router3.post("/patients/:id/send-reminder", async (req, res) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const clinicianId = req.user.id;
    const { title, message, reminder_type, due_date } = req.body;
    if (!title || !message) {
      res.status(400).json({ error: "\u122D\u12D5\u1235 \u12A5\u1293 \u1218\u120D\u12D5\u12AD\u1275 \u12EB\u1235\u1348\u120D\u130B\u120D (Title and message are required)" });
      return;
    }
    const reminder = await dataService.createReminder({
      patient_id: patientId,
      clinician_id: clinicianId,
      title: title.trim(),
      message: message.trim(),
      reminder_type: reminder_type || "appointment",
      due_date
    });
    res.status(201).json({
      message: "Reminder sent to patient successfully",
      reminder
    });
  } catch (err) {
    console.error("Send reminder error:", err);
    res.status(500).json({ error: "Failed to send reminder" });
  }
});
var clinicians_default = router3;

// server/routes/admin.ts
import { Router as Router4 } from "express";
import bcrypt4 from "bcryptjs";
var router4 = Router4();
router4.use(authenticateToken);
router4.use(requireRole("admin"));
router4.get("/overview", async (req, res) => {
  try {
    const stats = await dataService.getAdminStats();
    res.json({ stats });
  } catch (err) {
    console.error("Admin overview error:", err);
    res.status(500).json({ error: "Failed to retrieve admin stats" });
  }
});
router4.get("/patients", async (req, res) => {
  try {
    const patients = await dataService.getAllPatients();
    res.json({ patients });
  } catch (err) {
    console.error("Admin get patients error:", err);
    res.status(500).json({ error: "Failed to retrieve all patients" });
  }
});
router4.get("/clinicians", async (req, res) => {
  try {
    const clinicians = await dataService.getAllCliniciansWithPatients();
    res.json({ clinicians });
  } catch (err) {
    console.error("Admin get clinicians error:", err);
    res.status(500).json({ error: "Failed to retrieve clinicians" });
  }
});
router4.post("/clinicians", async (req, res) => {
  try {
    const { phone, id_number, password, name, specialty, facility_name } = req.body;
    if (!phone || !password || !name) {
      res.status(400).json({ error: "Phone, password, and name are required" });
      return;
    }
    const cleanPhone = phone.trim();
    const existing = await dataService.getUserByPhone(cleanPhone);
    if (existing) {
      res.status(400).json({ error: "This phone number is already registered" });
      return;
    }
    const password_hash = await bcrypt4.hash(password, 10);
    const newClinician = await dataService.createUser({
      phone: cleanPhone,
      id_number: id_number ? id_number.trim() : void 0,
      password_hash,
      name: name.trim(),
      role: "clinician",
      specialty: specialty || "General Midwife",
      facility_name: facility_name || "Health Center"
    });
    res.status(201).json({
      message: "Clinician account created successfully",
      clinician: {
        id: newClinician.id,
        phone: newClinician.phone,
        name: newClinician.name,
        specialty: newClinician.specialty,
        facility_name: newClinician.facility_name,
        created_at: newClinician.created_at
      }
    });
  } catch (err) {
    console.error("Admin create clinician error:", err);
    res.status(500).json({ error: "Failed to create clinician account" });
  }
});
var admin_default = router4;

// server/index.ts
dotenv2.config();
process.on("uncaughtException", (err) => {
  console.error("\u26A0\uFE0F [Process Uncaught Exception]:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("\u26A0\uFE0F [Process Unhandled Rejection]:", reason);
});
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 5e3;
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use((req, res, next) => {
  const apiIndex = req.url.indexOf("/api/");
  if (apiIndex > 0) {
    req.url = req.url.substring(apiIndex);
  } else if (req.url.endsWith("/api")) {
    req.url = "/api";
  }
  next();
});
app.use("/api/auth", auth_default);
app.use("*/api/auth", auth_default);
app.use("/api/patients", patients_default);
app.use("*/api/patients", patients_default);
app.use("/api/clinician", clinicians_default);
app.use("*/api/clinician", clinicians_default);
app.use("/api/admin", admin_default);
app.use("*/api/admin", admin_default);
var handleHealth = (req, res) => {
  res.json({
    status: "ok",
    appName: "Enat Agar Fullstack Maternal Health Platform",
    postgresConnected: isConnectedToPostgres,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
};
app.get("/api/health", handleHealth);
app.get("*/api/health", handleHealth);
var candidateDistDirs = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(__dirname, "dist"),
  path.resolve(__dirname, "./dist"),
  path.resolve(__dirname, "../dist"),
  path.resolve(process.cwd(), "../dist")
];
app.get("/favicon.ico", (req, res) => {
  for (const base of candidateDistDirs) {
    const iconPath = path.join(base, "icon.svg");
    if (fs.existsSync(iconPath)) {
      return res.sendFile(iconPath);
    }
  }
  res.status(204).end();
});
candidateDistDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
    const assetsDir = path.join(dir, "assets");
    if (fs.existsSync(assetsDir)) {
      app.use("/assets", express.static(assetsDir));
      app.use(express.static(assetsDir));
    }
  }
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  const basename = path.basename(req.path);
  for (const base of candidateDistDirs) {
    if (!fs.existsSync(base)) continue;
    const directPath = path.join(base, req.path);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return res.sendFile(directPath);
    }
    const inAssetsPath = path.join(base, "assets", req.path);
    if (fs.existsSync(inAssetsPath) && fs.statSync(inAssetsPath).isFile()) {
      return res.sendFile(inAssetsPath);
    }
    const byBasename = path.join(base, "assets", basename);
    if (fs.existsSync(byBasename) && fs.statSync(byBasename).isFile()) {
      return res.sendFile(byBasename);
    }
    if (basename.startsWith("index-") && basename.endsWith(".js")) {
      const assetsDir = path.join(base, "assets");
      if (fs.existsSync(assetsDir)) {
        const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.startsWith("index-") && f.endsWith(".js"));
        if (jsFiles.length > 0) {
          return res.sendFile(path.join(assetsDir, jsFiles[0]));
        }
      }
    }
    if (basename.startsWith("index-") && basename.endsWith(".css")) {
      const assetsDir = path.join(base, "assets");
      if (fs.existsSync(assetsDir)) {
        const cssFiles = fs.readdirSync(assetsDir).filter((f) => f.startsWith("index-") && f.endsWith(".css"));
        if (cssFiles.length > 0) {
          return res.sendFile(path.join(assetsDir, cssFiles[0]));
        }
      }
    }
  }
  next();
});
app.get("*", (req, res, next) => {
  if (req.originalUrl.includes("/api") || req.url.includes("/api") || req.path.includes("/api")) {
    return next();
  }
  for (const base of candidateDistDirs) {
    const htmlFile = path.join(base, "index.html");
    if (fs.existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }
  }
  res.status(200).send(`
    <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: auto;">
      <h2>\u{1F338} Enat Agar Backend API Running</h2>
      <p style="color: #666;">The backend is running, but <code>dist/index.html</code> was not found on this server.</p>
      <h4>Searched directories:</h4>
      <ul>
        ${candidateDistDirs.map((d) => `<li><code>${d}</code> \u2014 <b>${fs.existsSync(d) ? "Found directory" : "Not found"}</b></li>`).join("")}
      </ul>
      <p><b>Fix:</b> In cPanel Terminal, run <code>npm run build</code> and then click <b>Restart</b> in Node.js App.</p>
    </div>
  `);
});
var server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`\u{1F338} Enat Agar Fullstack Backend running on port ${PORT}`);
  console.log(`\u{1F517} API Base: http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
  initDatabase().then(() => {
    console.log(`\u{1F5C4}\uFE0F PostgreSQL Status: ${isConnectedToPostgres ? "CONNECTED \u2705" : "WAITING / MEMORY-SYNC ACTIVE \u26A1"}`);
  }).catch((err) => {
    console.warn("Database initialization warning:", err.message);
  });
});
var index_default = app;
export {
  index_default as default
};
