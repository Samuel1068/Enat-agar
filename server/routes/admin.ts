import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dataService } from '../dataService.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply admin authentication
router.use(authenticateToken);
router.use(requireRole('admin'));

// GET /api/admin/overview - Overall metrics
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await dataService.getAdminStats();
    res.json({ stats });
  } catch (err: any) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

// GET /api/admin/patients - Watch all patient profiles
router.get('/patients', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patients = await dataService.getAllPatients();
    res.json({ patients });
  } catch (err: any) {
    console.error('Admin get patients error:', err);
    res.status(500).json({ error: 'Failed to retrieve all patients' });
  }
});

// GET /api/admin/clinicians - Watch all clinicians and their assigned patient lists
router.get('/clinicians', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clinicians = await dataService.getAllCliniciansWithPatients();
    res.json({ clinicians });
  } catch (err: any) {
    console.error('Admin get clinicians error:', err);
    res.status(500).json({ error: 'Failed to retrieve clinicians' });
  }
});

// POST /api/admin/clinicians - Create a new clinician account
router.post('/clinicians', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone, id_number, password, name, specialty, facility_name } = req.body;

    if (!phone || !password || !name) {
      res.status(400).json({ error: 'Phone, password, and name are required' });
      return;
    }

    const cleanPhone = phone.trim();
    const existing = await dataService.getUserByPhone(cleanPhone);
    if (existing) {
      res.status(400).json({ error: 'This phone number is already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newClinician = await dataService.createUser({
      phone: cleanPhone,
      id_number: id_number ? id_number.trim() : undefined,
      password_hash,
      name: name.trim(),
      role: 'clinician',
      specialty: specialty || 'General Midwife',
      facility_name: facility_name || 'Health Center'
    });

    res.status(201).json({
      message: 'Clinician account created successfully',
      clinician: {
        id: newClinician.id,
        phone: newClinician.phone,
        name: newClinician.name,
        specialty: newClinician.specialty,
        facility_name: newClinician.facility_name,
        created_at: newClinician.created_at
      }
    });
  } catch (err: any) {
    console.error('Admin create clinician error:', err);
    res.status(500).json({ error: 'Failed to create clinician account' });
  }
});

export default router;
