import { pool, isConnectedToPostgres, memoryStore } from './db.js';

// Helper to query either PostgreSQL or fallback store
export const dataService = {
  // --- USERS ---
  async getUserByPhone(phone: string) {
    if (isConnectedToPostgres) {
      const res = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
      return res.rows[0] || null;
    }
    return memoryStore.users.find(u => u.phone === phone) || null;
  },

  async getUserById(id: number) {
    if (isConnectedToPostgres) {
      const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return memoryStore.users.find(u => u.id === id) || null;
  },

  async createUser(userData: {
    phone: string;
    id_number?: string;
    password_hash: string;
    name: string;
    role?: 'patient' | 'clinician' | 'admin';
    age?: string;
    specialty?: string;
    facility_name?: string;
  }) {
    const role = userData.role || 'patient';
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

    const newId = memoryStore.users.length > 0 ? Math.max(...memoryStore.users.map(u => u.id)) + 1 : 1;
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
      created_at: new Date()
    };
    memoryStore.users.push(user);
    return user;
  },

  // --- PATIENT PROFILES ---
  async getPatientProfile(userId: number) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        SELECT p.*, u.name, u.phone, u.age, u.id_number
        FROM patient_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = $1
      `, [userId]);
      return res.rows[0] || null;
    }
    const profile = memoryStore.patient_profiles.find(p => p.user_id === userId);
    if (!profile) return null;
    const user = memoryStore.users.find(u => u.id === userId);
    return { ...profile, name: user?.name, phone: user?.phone, age: user?.age, id_number: user?.id_number };
  },

  async upsertPatientProfile(userId: number, profileData: {
    lnmp?: string;
    ga_weeks?: number;
    ga_days?: number;
    ga_known_date?: string;
    calculation_method?: 'lnmp' | 'ga';
    blood_type?: string;
    rh_factor?: string;
    risk_notes?: string;
    emergency_contact?: string;
    quiz_progress?: any;
  }) {
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
        profileData.calculation_method || 'lnmp',
        profileData.blood_type || null,
        profileData.rh_factor || null,
        profileData.risk_notes || null,
        profileData.emergency_contact || null,
        profileData.quiz_progress ? JSON.stringify(profileData.quiz_progress) : '{}'
      ]);
      return res.rows[0];
    }

    let existing = memoryStore.patient_profiles.find(p => p.user_id === userId);
    if (!existing) {
      const newId = memoryStore.patient_profiles.length > 0 ? Math.max(...memoryStore.patient_profiles.map(p => p.id)) + 1 : 1;
      existing = {
        id: newId,
        user_id: userId,
        calculation_method: 'lnmp',
        updated_at: new Date()
      };
      memoryStore.patient_profiles.push(existing);
    }
    Object.assign(existing, profileData, { updated_at: new Date() });
    return existing;
  },

  // --- CLINICIAN - PATIENT ASSIGNMENTS ---
  async getClinicianPatients(clinicianId: number) {
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

    const assignments = memoryStore.clinician_patients.filter(cp => cp.clinician_id === clinicianId);
    return assignments.map(cp => {
      const u = memoryStore.users.find(user => user.id === cp.patient_id);
      const p = memoryStore.patient_profiles.find(prof => prof.user_id === cp.patient_id);
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

  async assignPatientToClinician(clinicianId: number, patientId: number, notes?: string) {
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
      cp => cp.clinician_id === clinicianId && cp.patient_id === patientId
    );
    if (existing) {
      existing.notes = notes || existing.notes;
      return existing;
    }
    const newId = memoryStore.clinician_patients.length > 0 ? Math.max(...memoryStore.clinician_patients.map(cp => cp.id)) + 1 : 1;
    const assignment = {
      id: newId,
      clinician_id: clinicianId,
      patient_id: patientId,
      assigned_at: new Date(),
      notes: notes || null
    };
    memoryStore.clinician_patients.push(assignment);
    return assignment;
  },

  // --- APPOINTMENTS ---
  async getPatientAppointments(patientId: number) {
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
    return memoryStore.appointments
      .filter(a => a.patient_id === patientId)
      .map(a => {
        const marker = memoryStore.users.find(u => u.id === a.marked_by);
        return { ...a, marked_by_name: marker?.name };
      });
  },

  async upsertAppointment(data: {
    patient_id: number;
    week: number;
    appointment_date: string;
    description: string;
    status?: string;
    missed_reason?: string;
    clinician_notes?: string;
    marked_by?: number;
  }) {
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
        data.status || 'scheduled',
        data.missed_reason || null,
        data.clinician_notes || null,
        data.marked_by || null
      ]);
      return res.rows[0];
    }

    const newId = memoryStore.appointments.length > 0 ? Math.max(...memoryStore.appointments.map(a => a.id)) + 1 : 1;
    const appt = {
      id: newId,
      patient_id: data.patient_id,
      week: data.week,
      appointment_date: data.appointment_date,
      description: data.description,
      status: data.status || 'scheduled',
      missed_reason: data.missed_reason || null,
      clinician_notes: data.clinician_notes || null,
      marked_by: data.marked_by || null,
      marked_at: new Date(),
      created_at: new Date()
    };
    memoryStore.appointments.push(appt);
    return appt;
  },

  async updateAppointmentStatus(appointmentId: number, status: string, missedReason?: string, notes?: string, markedBy?: number) {
    if (isConnectedToPostgres) {
      const res = await pool.query(`
        UPDATE appointments
        SET status = $1, missed_reason = $2, clinician_notes = $3, marked_by = $4, marked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [status, missedReason || null, notes || null, markedBy || null, appointmentId]);
      return res.rows[0];
    }

    const appt = memoryStore.appointments.find(a => a.id === appointmentId);
    if (appt) {
      appt.status = status;
      appt.missed_reason = missedReason || null;
      appt.clinician_notes = notes || null;
      appt.marked_by = markedBy || null;
      appt.marked_at = new Date();
    }
    return appt;
  },

  // --- REMINDERS ---
  async getPatientReminders(patientId: number) {
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
    return memoryStore.reminders
      .filter(r => r.patient_id === patientId)
      .map(r => {
        const clinician = memoryStore.users.find(u => u.id === r.clinician_id);
        return { ...r, clinician_name: clinician?.name };
      });
  },

  async createReminder(data: {
    patient_id: number;
    clinician_id?: number;
    title: string;
    message: string;
    reminder_type?: string;
    due_date?: string;
  }) {
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
        data.reminder_type || 'appointment',
        data.due_date || null
      ]);
      return res.rows[0];
    }

    const newId = memoryStore.reminders.length > 0 ? Math.max(...memoryStore.reminders.map(r => r.id)) + 1 : 1;
    const reminder = {
      id: newId,
      patient_id: data.patient_id,
      clinician_id: data.clinician_id || null,
      title: data.title,
      message: data.message,
      reminder_type: data.reminder_type || 'appointment',
      due_date: data.due_date || null,
      is_read: false,
      created_at: new Date()
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

    const patients = memoryStore.users.filter(u => u.role === 'patient');
    return patients.map(u => {
      const p = memoryStore.patient_profiles.find(prof => prof.user_id === u.id);
      const assignments = memoryStore.clinician_patients.filter(cp => cp.patient_id === u.id);
      const clinicians = assignments.map(cp => {
        const c = memoryStore.users.find(user => user.id === cp.clinician_id);
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

    const clinicians = memoryStore.users.filter(u => u.role === 'clinician');
    return clinicians.map(c => {
      const assignments = memoryStore.clinician_patients.filter(cp => cp.clinician_id === c.id);
      const patients = assignments.map(cp => {
        const pat = memoryStore.users.find(u => u.id === cp.patient_id);
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
      totalPatients: memoryStore.users.filter(u => u.role === 'patient').length,
      totalClinicians: memoryStore.users.filter(u => u.role === 'clinician').length,
      missedAppointments: memoryStore.appointments.filter(a => a.status === 'missed').length,
      scheduledAppointments: memoryStore.appointments.filter(a => a.status === 'scheduled').length
    };
  }
};
