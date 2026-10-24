export interface User {
  id: number;
  phone: string;
  id_number?: string;
  name: string;
  role: 'patient' | 'clinician' | 'admin';
  age?: string;
  specialty?: string;
  facility_name?: string;
  created_at?: string;
}

export interface PatientData {
  id?: number;
  name: string;
  phone?: string;
  id_number?: string;
  age: string;
  lnmp?: string; // ISO date string
  gaAtDate?: {
    weeks: number;
    days: number;
    date: string; // ISO date string when GA was known
  };
  ga_weeks?: number;
  ga_days?: number;
  calculationMethod: 'lnmp' | 'ga';
  calculation_method?: 'lnmp' | 'ga';
  blood_type?: string;
  rh_factor?: string;
  risk_notes?: string;
  emergency_contact?: string;
  quizProgress?: {
    totalScore: number;
    sectionResults: {
      [sectionId: number]: {
        score: number;
        total: number;
        isCompleted: boolean;
        answeredCount: number;
      }
    };
  };
}

export interface Appointment {
  week: number;
  date: Date;
  description: string;
}

export interface AppointmentRecord {
  id: number;
  patient_id: number;
  week: number;
  appointment_date: string;
  description: string;
  status: 'scheduled' | 'completed' | 'missed' | 'rescheduled';
  missed_reason?: string;
  marked_by?: number;
  marked_by_name?: string;
  clinician_notes?: string;
  created_at?: string;
}

export interface ReminderRecord {
  id: number;
  patient_id: number;
  clinician_id?: number;
  clinician_name?: string;
  title: string;
  message: string;
  reminder_type: 'appointment' | 'medication' | 'warning' | 'general';
  due_date?: string;
  is_read: boolean;
  created_at: string;
}

export interface ClinicianPatientSummary {
  id: number;
  name: string;
  phone: string;
  age?: string;
  id_number?: string;
  lnmp?: string;
  ga_weeks?: number;
  ga_days?: number;
  ga_known_date?: string;
  calculation_method?: 'lnmp' | 'ga';
  blood_type?: string;
  rh_factor?: string;
  risk_notes?: string;
  assigned_at?: string;
  assignment_notes?: string;
}

export interface AdminStats {
  totalPatients: number;
  totalClinicians: number;
  missedAppointments: number;
  scheduledAppointments: number;
}
