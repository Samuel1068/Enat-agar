import { User, PatientData, AppointmentRecord, ReminderRecord, ClinicianPatientSummary, AdminStats } from './types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('enatagar_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('enatagar_token', token);
  } else {
    localStorage.removeItem('enatagar_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // --- AUTH ---
  async register(payload: {
    phone: string;
    password: string;
    name: string;
    role?: 'patient' | 'clinician' | 'admin';
    id_number?: string;
    age?: string;
    specialty?: string;
    facility_name?: string;
  }) {
    const res = await request<{ message: string; token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setAuthToken(res.token);
    return res;
  },

  async login(phone: string, password: string) {
    const res = await request<{ message: string; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async getMe() {
    return request<{ user: User; profile: any }>('/auth/me');
  },

  logout() {
    setAuthToken(null);
  },

  // --- PATIENTS ---
  async getMyPatientProfile() {
    return request<{ profile: any; appointments: AppointmentRecord[]; reminders: ReminderRecord[] }>('/patients/me');
  },

  async syncMyPatientProfile(payload: Partial<PatientData>) {
    return request<{ message: string; profile: any }>('/patients/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getMyReminders() {
    return request<{ reminders: ReminderRecord[] }>('/patients/reminders');
  },

  // --- CLINICIANS ---
  async getClinicianPatients() {
    return request<{ patients: ClinicianPatientSummary[] }>('/clinician/patients');
  },

  async addPatientByCredentials(phone: string, password: string, notes?: string) {
    return request<{ message: string; patient: any }>('/clinician/patients/add-by-credentials', {
      method: 'POST',
      body: JSON.stringify({ phone, password, notes })
    });
  },

  async registerNewPatient(payload: {
    phone: string;
    name: string;
    age?: string;
    id_number?: string;
    password?: string;
    lnmp?: string;
    ga_weeks?: number;
    ga_days?: number;
    ga_known_date?: string;
    calculation_method?: 'lnmp' | 'ga';
    blood_type?: string;
    rh_factor?: string;
    risk_notes?: string;
    notes?: string;
  }) {
    return request<{ message: string; patient: any }>('/clinician/patients/register-new', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getPatientDetails(id: number) {
    return request<{ patient: any; appointments: AppointmentRecord[]; reminders: ReminderRecord[] }>(`/clinician/patients/${id}`);
  },

  async updatePatientProfile(id: number, payload: any) {
    return request<{ message: string; profile: any }>(`/clinician/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async updateAppointmentStatus(patientId: number, payload: {
    appointmentId?: number;
    week?: number;
    appointmentDate?: string;
    description?: string;
    status: 'scheduled' | 'completed' | 'missed' | 'rescheduled';
    missedReason?: string;
    notes?: string;
  }) {
    return request<{ message: string; appointment: AppointmentRecord }>(`/clinician/patients/${patientId}/appointment-status`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async sendReminder(patientId: number, payload: {
    title: string;
    message: string;
    reminder_type?: string;
    due_date?: string;
  }) {
    return request<{ message: string; reminder: ReminderRecord }>(`/clinician/patients/${patientId}/send-reminder`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // --- ADMIN ---
  async getAdminOverview() {
    return request<{ stats: AdminStats }>('/admin/overview');
  },

  async getAllPatients() {
    return request<{ patients: any[] }>('/admin/patients');
  },

  async getAllClinicians() {
    return request<{ clinicians: any[] }>('/admin/clinicians');
  },

  async createClinician(payload: {
    phone: string;
    name: string;
    password: string;
    id_number?: string;
    specialty?: string;
    facility_name?: string;
  }) {
    return request<{ message: string; clinician: any }>('/admin/clinicians', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
