import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { signJwt } from '../utils/jwt.js';
import { dataService } from '../dataService.js';
import { JWT_SECRET, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register (For Patients or Clinicians)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, id_number, password, name, role, age, specialty, facility_name } = req.body;

    if (!phone || !password || !name) {
      res.status(400).json({ error: 'ስልክ ቁጥር፣ ስም እና የይለፍ ቃል ያስፈልጋል (Phone, name, and password are required).' });
      return;
    }

    // Clean phone number (strip whitespace)
    const cleanPhone = phone.trim();

    // Check if phone already registered
    const existing = await dataService.getUserByPhone(cleanPhone);
    if (existing) {
      res.status(400).json({ error: 'ይህ ስልክ ቁጥር ቀድሞውኑ ተመዝግቧል (This phone number is already registered).' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userRole = role === 'clinician' ? 'clinician' : 'patient';

    const user = await dataService.createUser({
      phone: cleanPhone,
      id_number: id_number ? id_number.trim() : undefined,
      password_hash,
      name: name.trim(),
      role: userRole,
      age,
      specialty,
      facility_name
    });

    // If patient, initialize profile
    if (userRole === 'patient') {
      await dataService.upsertPatientProfile(user.id, {
        calculation_method: 'lnmp'
      });
    }

    // Generate JWT token
    const token = signJwt(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET
    );

    res.status(201).json({
      message: 'Registration successful',
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
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'የምዝገባ ስህተት አጋጥሟል (Server error during registration)' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ error: 'እባክዎ ስልክ ቁጥር እና የይለፍ ቃል ያስገቡ (Phone and password required).' });
      return;
    }

    const cleanPhone = phone.trim();
    const user = await dataService.getUserByPhone(cleanPhone);

    if (!user) {
      res.status(401).json({ error: 'ስልክ ቁጥር ወይም የይለፍ ቃል የተሳሳተ ነው (Invalid phone or password).' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'ስልክ ቁጥር ወይም የይለፍ ቃል የተሳሳተ ነው (Invalid phone or password).' });
      return;
    }

    const token = signJwt(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET
    );

    res.json({
      message: 'Login successful',
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
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'የመግቢያ ስህተት አጋጥሟል (Server error during login)' });
  }
});

// GET /api/auth/me (Check current logged in session)
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await dataService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let profile = null;
    if (user.role === 'patient') {
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
  } catch (err: any) {
    console.error('Auth /me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
