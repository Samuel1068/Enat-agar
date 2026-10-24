import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dataService } from '../dataService.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply clinician authorization
router.use(authenticateToken);
router.use(requireRole('clinician', 'admin'));

// GET /api/clinician/patients - List all patients assigned to this clinician
router.get('/patients', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clinicianId = req.user!.id;
    const patients = await dataService.getClinicianPatients(clinicianId);
    res.json({ patients });
  } catch (err: any) {
    console.error('Clinician list patients error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient list' });
  }
});

// POST /api/clinician/patients/add-by-credentials
// "Clinicians need the user phone number and password to add patient to their list"
router.post('/patients/add-by-credentials', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clinicianId = req.user!.id;
    const { phone, password, notes } = req.body;

    if (!phone || !password) {
      res.status(400).json({ error: 'የታካሚውን ስልክ ቁጥር እና የይለፍ ቃል ያስገቡ (Patient phone and password are required).' });
      return;
    }

    const cleanPhone = phone.trim();
    const patientUser = await dataService.getUserByPhone(cleanPhone);

    if (!patientUser) {
      res.status(404).json({ error: 'በዚህ ስልክ ቁጥር የተመዘገበ ታካሚ አልተገኘም (No patient found with this phone number).' });
      return;
    }

    if (patientUser.role !== 'patient') {
      res.status(400).json({ error: 'ይህ አካውንት የታካሚ አይደለም (This account is not a patient).' });
      return;
    }

    // Verify patient password to authorize linkage
    const isMatch = await bcrypt.compare(password, patientUser.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'የታካሚው የይለፍ ቃል የተሳሳተ ነው (Invalid patient password. Patient consent authorization failed).' });
      return;
    }

    // Assign to clinician
    const assignment = await dataService.assignPatientToClinician(clinicianId, patientUser.id, notes);
    const profile = await dataService.getPatientProfile(patientUser.id);

    res.json({
      message: 'ታካሚው በተሳካ ሁኔታ ወደ ዝርዝርዎ ተካቷል (Patient successfully linked to your care list)',
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
  } catch (err: any) {
    console.error('Add patient by credentials error:', err);
    res.status(500).json({ error: 'Failed to link patient' });
  }
});

// POST /api/clinician/patients/register-new
// Clinician can directly register a new patient
router.post('/patients/register-new', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clinicianId = req.user!.id;
    const { phone, name, age, id_number, password, lnmp, ga_weeks, ga_days, ga_known_date, calculation_method, blood_type, rh_factor, risk_notes, notes } = req.body;

    if (!phone || !name) {
      res.status(400).json({ error: 'ስልክ ቁጥር እና ስም ያስፈልጋል (Phone and name are required)' });
      return;
    }

    const cleanPhone = phone.trim();
    const existing = await dataService.getUserByPhone(cleanPhone);
    if (existing) {
      res.status(400).json({ error: 'ይህ ስልክ ቁጥር ቀድሞውኑ ተመዝግቧል (Phone number is already registered)' });
      return;
    }

    // Use default patient password if not specified
    const rawPassword = password || 'patient123';
    const password_hash = await bcrypt.hash(rawPassword, 10);

    const newUser = await dataService.createUser({
      phone: cleanPhone,
      id_number: id_number ? id_number.trim() : undefined,
      password_hash,
      name: name.trim(),
      role: 'patient',
      age
    });

    // Create profile
    await dataService.upsertPatientProfile(newUser.id, {
      lnmp,
      ga_weeks: ga_weeks ? parseInt(ga_weeks, 10) : undefined,
      ga_days: ga_days ? parseInt(ga_days, 10) : undefined,
      ga_known_date,
      calculation_method: calculation_method || 'lnmp',
      blood_type,
      rh_factor,
      risk_notes
    });

    // Link to clinician
    await dataService.assignPatientToClinician(clinicianId, newUser.id, notes || 'Registered by clinician');

    res.status(201).json({
      message: 'New patient registered and assigned successfully',
      patient: {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        age: newUser.age,
        id_number: newUser.id_number,
        tempPassword: rawPassword
      }
    });
  } catch (err: any) {
    console.error('Clinician register patient error:', err);
    res.status(500).json({ error: 'Failed to register patient' });
  }
});

// GET /api/clinician/patients/:id - Patient detailed profile, history, appointments, and reminders
router.get('/patients/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const profile = await dataService.getPatientProfile(patientId);

    if (!profile) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const appointments = await dataService.getPatientAppointments(patientId);
    const reminders = await dataService.getPatientReminders(patientId);

    res.json({
      patient: profile,
      appointments,
      reminders
    });
  } catch (err: any) {
    console.error('Get patient details error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient details' });
  }
});

// PUT /api/clinician/patients/:id - Watch and edit patient profile
router.put('/patients/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const { lnmp, ga_weeks, ga_days, ga_known_date, calculation_method, blood_type, rh_factor, risk_notes, notes } = req.body;

    const updatedProfile = await dataService.upsertPatientProfile(patientId, {
      lnmp,
      ga_weeks: ga_weeks !== undefined ? parseInt(ga_weeks, 10) : undefined,
      ga_days: ga_days !== undefined ? parseInt(ga_days, 10) : undefined,
      ga_known_date,
      calculation_method,
      blood_type,
      rh_factor,
      risk_notes
    });

    if (notes) {
      await dataService.assignPatientToClinician(req.user!.id, patientId, notes);
    }

    res.json({
      message: 'Patient profile updated successfully',
      profile: updatedProfile
    });
  } catch (err: any) {
    console.error('Update patient profile error:', err);
    res.status(500).json({ error: 'Failed to update patient profile' });
  }
});

// POST /api/clinician/patients/:id/appointment-status
// Clinicians can indicate if a patient missed an appointment
router.post('/patients/:id/appointment-status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const clinicianId = req.user!.id;
    const { appointmentId, week, appointmentDate, description, status, missedReason, notes } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required (e.g., missed, completed, scheduled)' });
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
        appointment_date: appointmentDate || new Date().toISOString(),
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
  } catch (err: any) {
    console.error('Update appointment status error:', err);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

// POST /api/clinician/patients/:id/send-reminder
// Clinicians can send reminder to their patients
router.post('/patients/:id/send-reminder', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const clinicianId = req.user!.id;
    const { title, message, reminder_type, due_date } = req.body;

    if (!title || !message) {
      res.status(400).json({ error: 'ርዕስ እና መልዕክት ያስፈልጋል (Title and message are required)' });
      return;
    }

    const reminder = await dataService.createReminder({
      patient_id: patientId,
      clinician_id: clinicianId,
      title: title.trim(),
      message: message.trim(),
      reminder_type: reminder_type || 'appointment',
      due_date
    });

    res.status(201).json({
      message: 'Reminder sent to patient successfully',
      reminder
    });
  } catch (err: any) {
    console.error('Send reminder error:', err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

export default router;
