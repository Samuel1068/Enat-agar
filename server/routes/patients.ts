import { Router, Response } from 'express';
import { dataService } from '../dataService.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/patients/me - Retrieve patient profile, appointments, reminders
router.get('/me', authenticateToken, requireRole('patient'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const profile = await dataService.getPatientProfile(userId);
    const appointments = await dataService.getPatientAppointments(userId);
    const reminders = await dataService.getPatientReminders(userId);

    res.json({
      profile,
      appointments,
      reminders
    });
  } catch (err: any) {
    console.error('Fetch patient profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient profile' });
  }
});

// PUT /api/patients/me - Sync local data to database
router.put('/me', authenticateToken, requireRole('patient'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
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
      message: 'Patient profile synced successfully',
      profile: updatedProfile
    });
  } catch (err: any) {
    console.error('Update patient profile error:', err);
    res.status(500).json({ error: 'Failed to update patient profile' });
  }
});

// GET /api/patients/reminders - Get patient's reminder messages
router.get('/reminders', authenticateToken, requireRole('patient'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reminders = await dataService.getPatientReminders(req.user!.id);
    res.json({ reminders });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

export default router;
