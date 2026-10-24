import { useState, useEffect, FormEvent, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  Activity, 
  Calendar, 
  Clock, 
  Info, 
  AlertTriangle, 
  Stethoscope, 
  Baby, 
  Menu,
  X,
  ChevronRight,
  CheckCircle2,
  Heart,
  Utensils,
  HelpCircle,
  Lock,
  Star,
  RefreshCw,
  Medal,
  Gem,
  Award,
  ExternalLink,
  Trophy as TrophyIcon,
  Bell,
  Download,
  Smartphone,
  LogOut,
  LogIn,
  Shield,
  KeyRound
} from 'lucide-react';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { formatEC, getNextAvailableAppointment } from '@/src/lib/ethiopian-calendar';
import { PatientData, Appointment, User, ReminderRecord } from '@/src/types';
import { ANC_SERVICES } from '@/src/constants';
import { QUIZ_DATA, QuizSection, Question } from './quizData';
import { EthiopianDatePicker } from '@/src/components/EthiopianDatePicker';
import { AuthModal } from '@/src/components/AuthModal';
import { ClinicianDashboard } from '@/src/components/ClinicianDashboard';
import { AdminDashboard } from '@/src/components/AdminDashboard';
import { api } from '@/src/api';

// ─── Notification Config Type ────────────────────────────────────────────────
interface NotificationConfig {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  enabled: boolean;
}

interface ScheduledNotification {
  week: number;
  description: string;
  appointmentDate: Date;
  notifyDate: Date;
  notifyTimeStr: string;
  isPast: boolean;
  isNext: boolean;
}

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  hour: 3,
  minute: 35,
  period: 'AM',
  enabled: true
};

const to24Hour = (hour: number, period: 'AM' | 'PM'): number => {
  if (period === 'AM' && hour === 12) return 0;
  if (period === 'PM' && hour !== 12) return hour + 12;
  return hour;
};

const formatTimeUntil = (targetDate: Date): string => {
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  if (diffMs <= 0) return 'አሁን';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days} ቀን ${hours} ሰዓት`;
  if (hours > 0) return `${hours} ሰዓት ${minutes} ደቂቃ`;
  return `${minutes} ደቂቃ`;
};

const getScheduledNotifications = (
  patient: PatientData,
  config: NotificationConfig
): ScheduledNotification[] => {
  const start = getEffectiveStartDate(patient);
  const weeks = [12, 20, 26, 30, 34, 36, 38, 40, 41, 42];
  const now = new Date();
  
  const notifications: ScheduledNotification[] = weeks.map(w => {
    const targetDate = addDays(start, w * 7);
    const notifyDate = new Date(targetDate);
    notifyDate.setDate(notifyDate.getDate() - 1);
    const notifHour = to24Hour(config.hour, config.period);
    notifyDate.setHours(notifHour, config.minute, 0, 0);
    
    const description = w === 12 ? "ከ12 ሳምንት ወይም ከ3 ወር በፊት" : 
                       w === 20 ? "20 ሳምንት ወይም 5 ወር ላይ" :
                       w === 26 ? "26 ሳምንት ወይም 6 ወር ከ2 ሳምንት ላይ" :
                       w === 30 ? "30 ሳምንት ወይም 7 ወር ከ2 ሳምንት ላይ" :
                       w === 34 ? "34 ሳምንት ወይም 8 ወር ከ2 ሳምንት ላይ" :
                       w === 36 ? "36 ሳምንት ወይም 9 ወር ሲገባ" :
                       w === 38 ? "38 ሳምንት ላይ" :
                       w === 40 ? "40 ሳምንት ላይ" :
                       w === 41 ? "41 ሳምንት ላይ" :
                       w === 42 ? "42 ሳምንት ላይ" :
                       `${w} ሳምንት ክትትል`;
    
    return {
      week: w,
      description,
      appointmentDate: getNextAvailableAppointment(targetDate),
      notifyDate,
      notifyTimeStr: `${config.hour}:${String(config.minute).padStart(2, '0')} ${config.period}`,
      isPast: notifyDate < now,
      isNext: false
    };
  });

  const futureNotifications = notifications.filter(n => !n.isPast);
  if (futureNotifications.length > 0) {
    futureNotifications[0].isNext = true;
  }
  return notifications;
};

const getEffectiveStartDate = (p: PatientData | null) => {
  if (!p) return new Date();
  if (p.calculationMethod === 'lnmp' && p.lnmp) {
    return new Date(p.lnmp);
  } else if (p.calculationMethod === 'ga' && p.gaAtDate && p.gaAtDate.date) {
    const { weeks, days, date } = p.gaAtDate;
    const totalDays = (weeks * 7) + (days || 0);
    return addDays(new Date(date), -totalDays);
  }
  if (p.lnmp) return new Date(p.lnmp);
  return new Date();
};

const calculateGA = (p: PatientData | null) => {
  const start = startOfDay(getEffectiveStartDate(p));
  const today = startOfDay(new Date());
  const diffDays = differenceInDays(today, start);
  if (diffDays < 0) return { weeks: 0, days: 0 };
  return {
    weeks: Math.floor(diffDays / 7),
    days: diffDays % 7
  };
};

const calculateEDD = (p: PatientData | null) => {
  return addDays(getEffectiveStartDate(p), 280);
};

const getANCSchedule = (p: PatientData | null): Appointment[] => {
  const start = getEffectiveStartDate(p);
  const weeks = [12, 20, 26, 30, 34, 36, 38, 40, 41, 42];
  return weeks.map(w => {
    const targetDate = addDays(start, w * 7);
    return {
      week: w,
      description: w === 12 ? "ከ12 ሳምንት ወይም ከ3 ወር በፊት" : 
                  w === 20 ? "20 ሳምንት ወይም 5 ወር ላይ" :
                  w === 26 ? "26 ሳምንት ወይም 6 ወር ከ2 ሳምንት ላይ" :
                  w === 30 ? "30 ሳምንት ወይም 7 ወር ከ2 ሳምንት ላይ" :
                  w === 34 ? "34 ሳምንት ወይም 8 ወር ከ2 ሳምንት ላይ" :
                  w === 36 ? "36 ሳምንት ወይም 9 ወር ሲገባ" :
                  w === 38 ? "38 ሳምንት ላይ" :
                  w === 40 ? "40 ሳምንት ላይ" :
                  w === 41 ? "41 ሳምንት ላይ" :
                  w === 42 ? "42 ሳምንት ላይ" :
                  `${w} ሳምንት ክትትል`,
      date: getNextAvailableAppointment(targetDate),
    };
  });
};

const sendToSW = async (type: string, data: any) => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type, ...data });
    }
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('registration');
  const [patient, setPatient] = useState<PatientData | null>(() => {
    const saved = localStorage.getItem('anc_patient');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifConfig, setNotifConfig] = useState<NotificationConfig>(() => {
    const saved = localStorage.getItem('anc_notification_config');
    return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_CONFIG;
  });
  const [swStatus, setSwStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Restore session from token on mount
  useEffect(() => {
    api.getMe()
      .then(res => {
        if (res.user) {
          setCurrentUser(res.user);
          if (res.user.role === 'clinician') {
            setActiveTab('clinician-portal');
          } else if (res.user.role === 'admin') {
            setActiveTab('admin-portal');
          } else if (res.profile) {
            setPatient(prev => ({
              name: res.user.name,
              phone: res.user.phone,
              age: res.user.age || prev?.age || '',
              id_number: res.user.id_number || prev?.id_number || '',
              lnmp: res.profile.lnmp || prev?.lnmp,
              calculationMethod: res.profile.calculation_method || prev?.calculationMethod || 'lnmp',
              blood_type: res.profile.blood_type || prev?.blood_type,
              rh_factor: res.profile.rh_factor || prev?.rh_factor,
              risk_notes: res.profile.risk_notes || prev?.risk_notes,
              quizProgress: res.profile.quiz_progress || prev?.quizProgress
            }));
          }
        }
      })
      .catch(() => {
        // Guest mode
      });
  }, []);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setActiveTab('registration');
  };

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = localStorage.getItem('install_dismissed');
      if (!dismissed) setShowInstallModal(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if ("Notification" in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setPermissionStatus);
      } else {
        setPermissionStatus(Notification.permission);
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setSwStatus('active')).catch(() => setSwStatus('error'));
    } else {
      setSwStatus('inactive');
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem('install_dismissed', 'true');
    setShowInstallModal(false);
    setInstallPrompt(null);
  };

  const handleDismissInstall = () => {
    localStorage.setItem('install_dismissed', 'true');
    setShowInstallModal(false);
  };

  const syncDataWithSW = useCallback(() => {
    if (patient) {
      const schedule = getANCSchedule(patient);
      const appointments = schedule.map(apt => ({
        week: apt.week,
        description: apt.description,
        dateStr: format(apt.date, 'yyyy-MM-dd'),
        displayDate: formatEC(apt.date)
      }));
      sendToSW('STORE_ANC_DATA', { appointments, notificationConfig: notifConfig });
    }
  }, [patient, notifConfig]);

  useEffect(() => {
    syncDataWithSW();
    localStorage.setItem('anc_notification_config', JSON.stringify(notifConfig));
  }, [notifConfig, syncDataWithSW]);

  useEffect(() => {
    if (patient) {
      localStorage.setItem('anc_patient', JSON.stringify(patient));
      syncDataWithSW();
    }
  }, [patient, syncDataWithSW]);

  const getUpcomingAppointment = () => {
    if (!patient) return null;
    const schedule = getANCSchedule(patient);
    const today = startOfDay(new Date());
    return schedule.find(appointment => {
      const apptDate = startOfDay(appointment.date);
      const diff = differenceInDays(apptDate, today);
      return diff === 1;
    }) || null;
  };

  const upcomingAppointment = getUpcomingAppointment();

  // ─── Notification scheduler ─────────────────────────────────────────────────
  // SW cannot schedule future tasks, so we use setTimeout from the main thread
  // and delegate showNotification() to the SW for OS-level sound + banner.
  useEffect(() => {
    if (!patient || permissionStatus !== 'granted' || !notifConfig.enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const fireViaServiceWorker = async (tag: string) => {
      try {
        if (localStorage.getItem(tag)) return;
        const registration = await navigator.serviceWorker.ready;
        if (!registration) return;

      // ← Call directly on registration, NOT via postMessage
      // postMessage → SW message event → showNotification is silenced on Android
        await registration.showNotification('የቀጠሮ ማስታወሻ – Enat Agar', {
          body: 'ነገ የእርግዝና ክትትል ቀጠሮ አለሽ፡፡',
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag,
          requireInteraction: true,
          silent: false,
          // @ts-ignore
          vibrate: [300, 100, 300, 100, 500, 200, 500],
          actions: [
            { action: 'open',    title: 'መተግበሪያውን ክፈት' },
            { action: 'dismiss', title: 'አሰናብት' },
          ],
          });

    localStorage.setItem(tag, 'true');
  } catch (err) {
    console.warn('[Notif] failed:', err);
  }
  };
    

    const scheduleForToday = () => {
      if (timer) clearTimeout(timer);

      const schedule = getANCSchedule(patient);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

      const apt = schedule.find(a => format(a.date, 'yyyy-MM-dd') === tomorrowStr);
      if (!apt) return;

      const notifKey = `notified_${apt.week}_${tomorrowStr}`;
      if (localStorage.getItem(notifKey)) return;

      const notifHour = to24Hour(notifConfig.hour, notifConfig.period);
      const target = new Date();
      target.setHours(notifHour, notifConfig.minute, 0, 0);

      const msUntil = target.getTime() - Date.now();

      if (msUntil <= 0) {
        // Time already passed today — fire immediately (covers app-reopen case)
        fireViaServiceWorker(notifKey);
      } else {
        timer = setTimeout(() => fireViaServiceWorker(notifKey), msUntil);
      }
    };

    try {
    scheduleForToday();
    } catch (err) {
    console.warn('[Notif] scheduleForToday error:', err);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleForToday();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [patient, notifConfig, permissionStatus]);

  const tabs = [
    ...(currentUser?.role === 'clinician' ? [{ id: 'clinician-portal', label: 'ባለሙያ ፖርታል', icon: Stethoscope }] : []),
    ...(currentUser?.role === 'admin' ? [{ id: 'admin-portal', label: 'አስተዳዳሪ', icon: Shield }] : []),
    { id: 'registration', label: 'ምዝገባ', icon: UserPlus },
    { id: 'tracker', label: 'መከታተያ', icon: Activity },
    { id: 'reminders', label: 'ቀጠሮዎች', icon: Calendar },
    { id: 'quiz', label: 'ጥያቄ', icon: HelpCircle },
    { id: 'pre-pregnancy', label: 'ቅድመ ዝግጅት', icon: Heart },
    { id: 'symptoms', label: 'ምልክቶች', icon: Info },
    { id: 'danger-signs', label: 'አደገኛ ምልክቶች', icon: AlertTriangle },
    { id: 'testing', label: 'ምርመራ', icon: Stethoscope },
    { id: 'general-info', label: 'አጠቃላይ መረጃ', icon: Baby },
    { id: 'labor', label: 'የምጥ ምልክቶች', icon: AlertTriangle },
    { id: 'postnatal', label: 'ድህረ ወሊድ', icon: Baby },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'clinician-portal':
        return currentUser ? <ClinicianDashboard currentUser={currentUser} /> : null;
      case 'admin-portal':
        return currentUser ? <AdminDashboard currentUser={currentUser} /> : null;
      case 'registration':
        return (
          <RegistrationView
            patient={patient}
            setPatient={setPatient}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            onComplete={() => setActiveTab('tracker')}
            notifConfig={notifConfig}
            onNotifConfigChange={setNotifConfig}
            permissionStatus={permissionStatus}
          />
        );
      case 'quiz':
        return <QuizView patient={patient} setPatient={setPatient} calculateGA={calculateGA} />;
      case 'tracker':
        return <TrackerView patient={patient} calculateGA={calculateGA} calculateEDD={calculateEDD} />;
      case 'reminders':
        return <RemindersView patient={patient} getANCSchedule={getANCSchedule} notifConfig={notifConfig} />;
      case 'pre-pregnancy':
        return <PrePregnancyView />;
      case 'symptoms':
        return <SymptomsView />;
      case 'danger-signs':
        return <DangerSignsView />;
      case 'testing':
        return <TestingView />;
      case 'general-info':
        return <GeneralInfoView />;
      case 'labor':
        return <LaborSignsView />;
      case 'postnatal':
        return <PostnatalView />;
      default:
        return (
          <RegistrationView
            patient={patient}
            setPatient={setPatient}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            onComplete={() => setActiveTab('tracker')}
            notifConfig={notifConfig}
            onNotifConfigChange={setNotifConfig}
            permissionStatus={permissionStatus}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-text-dark font-sans pb-24">
      {/* Install Prompt Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Download className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-dark">Enat Agar መተግበሪያውን ይጫኑ</h3>
                  <p className="text-sm text-text-muted mt-1 leading-relaxed">
                    ለተሻለ አገልግሎት እና ለቀጠሮ ማስታወሻዎች መተግበሪያውን በስልክዎ ላይ ይጫኑ።
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={handleInstall}
                  className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  አሁን ጫን
                </button>
                <button 
                  onClick={handleDismissInstall}
                  className="w-full py-3.5 bg-gray-100 text-text-muted font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  አሁን አይሆንም
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(u) => {
          setCurrentUser(u);
          if (u.role === 'clinician') setActiveTab('clinician-portal');
          else if (u.role === 'admin') setActiveTab('admin-portal');
          else setActiveTab('tracker');
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-white px-4 py-3.5 shadow-md">
        <div className={cn("mx-auto flex items-center justify-between", ['clinician-portal', 'admin-portal'].includes(activeTab) ? "max-w-4xl" : "max-w-md")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Baby className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">
                {currentUser?.role === 'clinician' ? 'ባለሙያ ፖርታል' : currentUser?.role === 'admin' ? 'አስተዳዳሪ ፖርታል' : (patient ? patient.name : 'የእርግዝና መከታተያ (ANC Tracker)')}
              </h1>
              {patient && !['clinician', 'admin'].includes(currentUser?.role || '') && (
                <div className="text-[10px] opacity-80 font-medium uppercase tracking-wider">
                  {calculateGA(patient).weeks} ሳምንታት
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-white/15 py-1 px-2.5 rounded-xl border border-white/20">
                <span className="text-xs font-bold truncate max-w-[100px]">{currentUser.name.split(' ')[0]}</span>
                <span className="text-[10px] bg-white text-primary px-1.5 py-0.5 rounded font-extrabold uppercase">
                  {currentUser.role === 'clinician' ? 'ባለሙያ' : currentUser.role === 'admin' ? 'አስተዳዳሪ' : 'ታካሚ'}
                </span>
                <button
                  onClick={handleLogout}
                  title="ውጣ (Logout)"
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-white text-primary hover:bg-white/95 text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>ግባ / ተመዝገብ</span>
              </button>
            )}

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-40 bg-white pt-20 px-6 overflow-y-auto pb-24 flex flex-col"
          >
            <div className="grid grid-cols-1 gap-2 flex-grow">
              {tabs
                .filter((tab) => !['registration', 'reminders', 'tracker', 'quiz', 'clinician-portal', 'admin-portal'].includes(tab.id))
                .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all",
                    activeTab === tab.id ? "bg-primary-light text-primary" : "hover:bg-gray-50"
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-semibold text-sm">{tab.label}</span>
                </button>
              ))}
              
              <a
                href="https://tena-agar.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-gray-50 text-text-dark"
                onClick={() => setIsMenuOpen(false)}
              >
                <ExternalLink className="w-5 h-5" />
                <span className="font-semibold text-sm">ሌሎች (ለጨቅላ/ neonate)</span>
              </a>
            </div>

            <div className="mt-8 p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                የህክምና ማሳሰቢያ
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                ይህ መተግበሪያ ትምህርታዊ መረጃዎችን ለመስጠት ብቻ የተዘጋጀ ሲሆን የባለሙያ ህክምና ምክርን፣ የህክምና ምርመራን ወይም ህክምናን ለመተካት የታሰበ አይደለም።
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn("mx-auto p-4", ['clinician-portal', 'admin-portal'].includes(activeTab) ? "max-w-4xl" : "max-w-md")}>
        {upcomingAppointment && !['clinician-portal', 'admin-portal'].includes(activeTab) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-4 items-start shadow-sm"
          >
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 text-white">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 text-sm">ነገ ቀጠሮ አለቦት!</h3>
              <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
                ለ{upcomingAppointment.description} የነገ ቀጠሮዎን አይርሱ።
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                <Calendar className="w-3 h-3" />
                {formatEC(upcomingAppointment.date)} ({format(upcomingAppointment.date, 'MMM d, yyyy')})
              </div>
            </div>
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-6 py-3 flex justify-around items-center z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-bottom">
        {tabs
          .filter((tab) => {
            if (currentUser?.role === 'clinician') {
              return ['clinician-portal', 'tracker', 'reminders', 'quiz'].includes(tab.id);
            }
            if (currentUser?.role === 'admin') {
              return ['admin-portal', 'tracker', 'reminders', 'quiz'].includes(tab.id);
            }
            return ['registration', 'tracker', 'reminders', 'quiz'].includes(tab.id);
          })
          .map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === tab.id ? "text-primary scale-110" : "text-text-muted"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Reminders View ──────────────────────────────────────────────────────────
// Shows the rich notification schedule (from ማስተካከያ) + each visit's details
function RemindersView({ patient, getANCSchedule, notifConfig }: { 
  patient: PatientData | null; 
  getANCSchedule: any;
  notifConfig: NotificationConfig;
}) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [clinicianReminders, setClinicianReminders] = useState<ReminderRecord[]>([]);

  useEffect(() => {
    api.getMyReminders()
      .then(res => setClinicianReminders(res.reminders || []))
      .catch(() => {});
  }, []);

  if (!patient) return <div className="text-center py-20 text-text-muted text-sm font-medium">እባክዎን መጀመሪያ ይመዝገቡ</div>;

  const schedule = getANCSchedule(patient);
  const scheduledNotifications = getScheduledNotifications(patient, notifConfig);
  const today = new Date();

  // Build a lookup of notification info by week for merging
  const notifByWeek: Record<number, ScheduledNotification> = {};
  scheduledNotifications.forEach(n => { notifByWeek[n.week] = n; });

  // Next notification card
  const nextNotif = scheduledNotifications.find(n => n.isNext);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text-dark">ቀጣይ ቀጠሮዎች</h2>
        <p className="text-xs text-text-muted">
          ማስታወሻ ሰዓት፡ {notifConfig.hour}:{String(notifConfig.minute).padStart(2, '0')} {notifConfig.period === 'AM' ? 'ጠዋት' : 'ከሰዓት'}
        </p>
      </div>

      {/* Messages / Alerts from Clinician */}
      {clinicianReminders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <Stethoscope className="w-4 h-4 text-emerald-600" />
            ከባለሙያዎ የተላኩ ማሳሰቢያዎች ({clinicianReminders.length})
          </div>
          <div className="space-y-2">
            {clinicianReminders.map(rem => (
              <div key={rem.id} className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-emerald-950">
                  <span>{rem.title}</span>
                  {rem.clinician_name && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-medium">
                      {rem.clinician_name}
                    </span>
                  )}
                </div>
                <p className="text-emerald-900 leading-relaxed">{rem.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next notification countdown card */}
      {nextNotif && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">ቀጣይ ማስታወሻ</p>
            <p className="font-bold text-sm text-text-dark truncate">{nextNotif.description}</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {format(nextNotif.notifyDate, 'MMM d')} በ{nextNotif.notifyTimeStr}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-black text-primary text-sm">{formatTimeUntil(nextNotif.notifyDate)}</p>
            <p className="text-[9px] text-text-muted">ይቀራል</p>
          </div>
        </div>
      )}

      {/* Appointment list with rich notification info */}
      <div className="space-y-3">
        {schedule.map((apt: Appointment, idx: number) => {
          const isPast = apt.date < today;
          const isExpanded = expandedWeek === apt.week;
          const services = ANC_SERVICES[apt.week];
          const notif = notifByWeek[apt.week];

          return (
            <div key={idx} className="space-y-2">
              <button 
                onClick={() => setExpandedWeek(isExpanded ? null : apt.week)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all",
                  isPast ? "bg-gray-50 border-border opacity-60" : "bg-white border-border shadow-sm",
                  notif?.isNext && "border-primary ring-1 ring-primary/20",
                  isExpanded && "border-primary ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
                    notif?.isNext ? "bg-primary text-white" :
                    isPast ? "bg-gray-200 text-text-muted" : "bg-primary-light text-primary"
                  )}>
                    {apt.week}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-text-dark leading-tight truncate">{apt.description}</p>
                      {notif?.isNext && (
                        <span className="px-1.5 py-0.5 bg-primary text-white text-[8px] font-black rounded-full uppercase shrink-0">
                          ቀጣይ
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center mt-0.5">
                      <p className="text-[10px] text-primary font-bold">{formatEC(apt.date)} (EC)</p>
                      <span className="text-[8px] text-text-muted">•</span>
                      <p className="text-[10px] text-text-muted font-medium">{format(apt.date, 'MMM dd, yyyy')} (GC)</p>
                    </div>
                    {/* Rich notification timing line */}
                    {notif && !notif.isPast && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Bell className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                        <p className="text-[9px] text-amber-600 font-bold">
                          ማስታወሻ፡ {format(notif.notifyDate, 'MMM d')} በ{notif.notifyTimeStr}
                          {notif.isNext && (
                            <span className="text-primary ml-1">· {formatTimeUntil(notif.notifyDate)} ይቀራል</span>
                          )}
                        </p>
                      </div>
                    )}
                    {notif?.isPast && (
                      <p className="text-[9px] text-text-muted mt-0.5">ማስታወሻ አልፏል</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center shrink-0 ml-2">
                  {isExpanded ? (
                    <div className="p-1 rounded-full bg-primary/10 text-primary">
                      <X className="w-4 h-4" />
                    </div>
                  ) : (
                    <ChevronRight className="text-border w-5 h-5" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && services && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Utensils className="w-3 h-3" /> የምንሰጣቸው አገልግሎቶች
                      </h4>
                      <ul className="space-y-2">
                        {services.map((service: string, sIdx: number) => (
                          <li key={sIdx} className="flex gap-2 text-xs text-text-dark font-medium leading-relaxed">
                            <span className="text-primary mt-1">•</span>
                            {service}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Registration View ───────────────────────────────────────────────────────
function RegistrationView({ 
  patient, 
  setPatient, 
  currentUser,
  setCurrentUser,
  onComplete,
  notifConfig,
  onNotifConfigChange,
  permissionStatus
}: { 
  patient: PatientData | null;
  setPatient: (p: PatientData) => void;
  currentUser?: User | null;
  setCurrentUser?: (u: User | null) => void;
  onComplete: () => void;
  notifConfig: NotificationConfig;
  onNotifConfigChange: (c: NotificationConfig) => void;
  permissionStatus: NotificationPermission;
}) {
  const [formData, setFormData] = useState<PatientData>(() => {
    const defaults = {
      name: '',
      age: '',
      lnmp: new Date().toISOString(),
      calculationMethod: 'lnmp' as const,
      gaAtDate: { weeks: 0, days: 0, date: new Date().toISOString() }
    };
    if (!patient) return defaults;
    return {
      ...defaults,
      ...patient,
      gaAtDate: { ...defaults.gaAtDate, ...(patient.gaAtDate || {}) }
    };
  });
  const [phone, setPhone] = useState(patient?.phone || currentUser?.phone || '');
  const [idNumber, setIdNumber] = useState(patient?.id_number || currentUser?.id_number || '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Local notification time state
  const [tempHour, setTempHour] = useState(notifConfig.hour);
  const [tempMinute, setTempMinute] = useState(notifConfig.minute);
  const [tempPeriod, setTempPeriod] = useState<'AM' | 'PM'>(notifConfig.period);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onNotifConfigChange({ hour: tempHour, minute: tempMinute, period: tempPeriod, enabled: true });

    const updatedData: PatientData = {
      ...formData,
      phone: phone.trim() || formData.phone,
      id_number: idNumber.trim() || formData.id_number
    };

    setPatient(updatedData);

    // Save and sync to PostgreSQL database
    try {
      if (currentUser) {
        await api.syncMyPatientProfile({
          lnmp: updatedData.lnmp,
          ga_weeks: updatedData.gaAtDate?.weeks,
          ga_days: updatedData.gaAtDate?.days,
          calculation_method: updatedData.calculationMethod
        });
      } else if (phone && password) {
        const authRes = await api.register({
          phone: phone.trim(),
          password,
          name: updatedData.name,
          age: updatedData.age,
          id_number: idNumber ? idNumber.trim() : undefined,
          role: 'patient'
        });
        if (setCurrentUser) setCurrentUser(authRes.user);
        await api.syncMyPatientProfile({
          lnmp: updatedData.lnmp,
          ga_weeks: updatedData.gaAtDate?.weeks,
          ga_days: updatedData.gaAtDate?.days,
          calculation_method: updatedData.calculationMethod
        });
      }
    } catch (err: any) {
      console.warn('Backend sync note:', err.message);
    } finally {
      setIsSubmitting(false);
    }

    onComplete();
  };

  const handleReset = () => {
    localStorage.removeItem('anc_patient');
    window.location.reload();
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text-dark">የእናቶች ምዝገባ</h2>
        <p className="text-sm text-text-muted">እባክዎን መረጃዎን በትክክል ያስገቡ</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">ሙሉ ስም</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              placeholder="ስም ያስገቡ"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                ስልክ ቁጥር <span className="text-primary">*ዋና መለያ (Phone)</span>
              </label>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                placeholder="0911000000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">መለያ ቁጥር (ID / Card Number)</label>
              <input 
                type="text" 
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                className="w-full p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                placeholder="አማራጭ (ለምሳሌ፡ PAT-101)"
              />
            </div>
          </div>

          {!currentUser && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                የይለፍ ቃል (Password) <span className="text-primary">*ለመረጃ ደህንነትና ለባለሙያ ፈቃድ</span>
              </label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                placeholder="የይለፍ ቃል ያስገቡ (ለምሳሌ፡ patient123)"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">እድሜ</label>
            <input 
              type="number" 
              required
              value={formData.age}
              onChange={e => setFormData({...formData, age: e.target.value})}
              className="w-full p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              placeholder="እድሜ"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">ለማስላት የፈለጉት መረጃ</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setFormData({...formData, calculationMethod: 'lnmp'})}
              className={cn(
                "py-2 px-3 rounded-lg text-xs font-bold transition-all",
                formData.calculationMethod === 'lnmp' ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-dark"
              )}
            >
              የመጨረሻ የወር አበባ (LNMP)
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, calculationMethod: 'ga'})}
              className={cn(
                "py-2 px-3 rounded-lg text-xs font-bold transition-all",
                formData.calculationMethod === 'ga' ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-dark"
              )}
            >
              አሁን ያለኝ ሳምንት (GA)
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {formData.calculationMethod === 'lnmp' ? (
            <motion.div
              key="lnmp"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="p-4 bg-primary-light/20 rounded-2xl border border-primary-light/50 space-y-4"
            >
              <EthiopianDatePicker 
                label="የመጨረሻ የወር አበባ ቀን (LNMP - EC)"
                value={formData.lnmp || new Date().toISOString()}
                onChange={val => setFormData({...formData, lnmp: val})}
              />
              <p className="text-sm text-text-dark leading-relaxed font-medium">የመጨረሻ የወር አበባ የታየብዎትን ቀን ለመጠቀም:</p>
              <ul style={{ listStyleType: 'square' }} className="text-sm text-text-dark leading-relaxed font-medium pl-4 space-y-1">
                <li>ቀኑን በትክክል ያውቁ ከሆነ</li>
                <li>የወር አበባ ቢያንስ ለመጨረሻዎቹ 3 ወራት ቀኑን ጠብቆ ይመጣ ከነበረ</li>
                <li>የወሊድ መቆጣጠሪያ ዕንክብል (COC) ይወስዱ ከነበረ ካቋረጡ ጀምሮ የወር አበባ ቢያንስ ለመጨረሻዎቹ 3 ወራት ቀኑን ጠብቆ ይመጣ ከነበረ</li>
                <li>የ 3 ወር የመርፌ ወሊድ መከላከያ ይወስዱ ከነበረ መርፌውን ካቆሙ ጀምሮ የወር አበባ ቢያንስ ለመጨረሻዎቹ 6 ወራት ቀኑን ጠብቆ ይመጣ ከነበረ</li>
                <li>በክንድ የሚቀበር ወይም በማህፀን የሚገባ የወሊድ መከላከያዎን ካስወጡ ጀምሮ የወር አበባ ቢያንስ 1 ጊዜ አይተው ከነበረ</li>
              </ul>
              <p className="text-sm text-text-dark leading-relaxed font-medium">ከላይ ከተዘረዘሩት አንዱም ካልሆነ ቀንዎ አስተማማኝ ስላልሆነ ሌላ ተጓዳኝ አቆጣጠር (ultrasound) እንጠቀማለን።</p>
            </motion.div>
          ) : (
            <motion.div
              key="ga"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-4"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">ሳምንት</label>
                    <input 
                      type="number"
                      min="0"
                      max="50"
                      value={formData.gaAtDate?.weeks}
                      onChange={e => setFormData({
                        ...formData, 
                        gaAtDate: { ...formData.gaAtDate!, weeks: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full p-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">ቀን</label>
                    <input 
                      type="number"
                      min="0"
                      max="6"
                      value={formData.gaAtDate?.days}
                      onChange={e => setFormData({
                        ...formData, 
                        gaAtDate: { ...formData.gaAtDate!, days: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full p-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <EthiopianDatePicker 
                  label="ከላይ የተጠቀሰው ሳምንት የነበረበት ቀን"
                  value={formData.gaAtDate?.date || new Date().toISOString()}
                  onChange={val => setFormData({
                    ...formData, 
                    gaAtDate: { ...formData.gaAtDate!, date: val }
                  })}
                />
              </div>
              <p className="text-[10px] text-amber-800/70 font-medium">የመጨረሻ የወር አበባ ቀንዎን የማያውቁ ከሆነ እና በሀኪም የተነገሮት ሳምንት ካለ ይህንን ይጠቀሙ</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Notification Time Picker (moved from ማስተካከያ) ──────────────── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <h3 className="font-bold text-sm flex items-center gap-2 text-text-dark">
              <Bell className="w-4 h-4 text-primary" />
              የቀጠሮ ማስታወሻ ሰዓት ይምረጡ
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">ቀጠሮ ከ1 ቀን ቀደም ሲል ማስታወሻ ይላካል</p>
          </div>

          {/* Permission warning */}
          {permissionStatus === 'denied' && (
            <div className="mx-4 mt-4 p-3 bg-danger/5 border border-danger/20 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
              <p className="text-[11px] text-danger font-bold">ማስታወሻ ተከልክሏል። በስልክዎ ቅንብሮች ያብሩ።</p>
            </div>
          )}
          {permissionStatus === 'default' && (
            <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
              <p className="text-[11px] text-amber-800 font-bold">ማስታወሻ ለማግኘት ፍቃድ ያስፈልጋል</p>
              <button
                type="button"
                onClick={requestPermission}
                className="text-[11px] text-primary font-black underline shrink-0"
              >
                ፍቃድ ስጥ
              </button>
            </div>
          )}

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 justify-center">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase text-center block">ሰዓት</label>
                <select
                  value={tempHour}
                  onChange={(e) => setTempHour(parseInt(e.target.value))}
                  className="w-20 p-3 bg-gray-50 border border-border rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <span className="text-2xl font-bold text-text-muted mt-6">:</span>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase text-center block">ደቂቃ</label>
                <select
                  value={tempMinute}
                  onChange={(e) => setTempMinute(parseInt(e.target.value))}
                  className="w-20 p-3 bg-gray-50 border border-border rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  {Array.from({length: 60}, (_, i) => i).map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
              
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setTempPeriod('AM')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      tempPeriod === 'AM' ? "bg-primary text-white" : "bg-gray-100 text-text-muted"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempPeriod('PM')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      tempPeriod === 'PM' ? "bg-primary text-white" : "bg-gray-100 text-text-muted"
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
        {/* ────────────────────────────────────────────────────────────────── */}

        <div className="pt-2">
          <button 
            type="submit"
            className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all text-sm uppercase tracking-wider"
          >
            መረጃውን መዝግብ
          </button>
          
          {patient && !showConfirmDelete && (
            <button 
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="w-full py-3.5 bg-white text-danger font-bold rounded-xl border border-danger/10 hover:bg-danger/5 transition-all mt-4 text-xs"
            >
              መረጃውን አጥፋ
            </button>
          )}

          {showConfirmDelete && (
            <div className="p-4 bg-danger/5 rounded-2xl border border-danger/10 space-y-3 mt-4">
              <p className="text-danger text-xs font-bold text-center">ሁሉንም መረጃ ማጥፋት ይፈልጋሉ?</p>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={handleReset}
                  className="py-2.5 bg-danger text-white rounded-xl font-bold text-xs"
                >
                  አዎ አጥፋ
                </button>
                <button 
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="py-2.5 bg-white text-text-muted rounded-xl font-bold text-xs border border-border"
                >
                  ተመለስ
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Quiz View ───────────────────────────────────────────────────────────────
import confetti from 'canvas-confetti';

function BalloonAnimation() {
  const balloons = [
    { id: 1, color: '#FF6B6B', left: '10%' },
    { id: 2, color: '#4ECDC4', left: '30%' },
    { id: 3, color: '#45B7D1', left: '50%' },
    { id: 4, color: '#FFA07A', left: '70%' },
    { id: 5, color: '#98D8C8', left: '90%' },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {balloons.map((b) => (
        <motion.div
          key={b.id}
          initial={{ y: '110vh', rotate: 0 }}
          animate={{ 
            y: '-10vh', 
            rotate: [0, 10, -10, 0],
            transition: { 
              y: { duration: 1.5 + (b.id * 0.2), ease: "easeOut" },
              rotate: { duration: 1, repeat: Infinity, ease: "easeInOut" }
            } 
          }}
          style={{ left: b.left }}
          className="absolute"
        >
          <div className="relative">
            <div 
              style={{ backgroundColor: b.color }}
              className="w-12 h-16 rounded-[100%_100%_100%_100%/120%_120%_80%_80%] shadow-lg"
            />
            <div className="w-0.5 h-12 bg-gray-300 mx-auto" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function QuizView({ patient, setPatient, calculateGA }: { patient: PatientData | null, setPatient: (p: PatientData) => void, calculateGA: any }) {
  const [selectedSection, setSelectedSection] = useState<QuizSection | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<Question[]>([]);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [showBalloons, setShowBalloons] = useState(false);
  const autoNextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    };
  }, []);

  if (!patient) return <div className="text-center py-20 text-text-muted text-sm font-medium">እባክዎን መጀመሪያ ይመዝገቡ</div>;

  const currentGA = calculateGA(patient).weeks;
  const progress = patient.quizProgress || { totalScore: 0, sectionResults: {} };

  const getTrophyInfo = (percentage: number) => {
    if (percentage === 100) return { icon: Gem, color: 'text-cyan-500', bg: 'bg-cyan-50', label: 'Gems' };
    if (percentage > 90) return { icon: TrophyIcon, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Gold' };
    if (percentage > 80) return { icon: TrophyIcon, color: 'text-slate-400', bg: 'bg-slate-50', label: 'Silver' };
    if (percentage > 70) return { icon: Award, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Bronze' };
    return null;
  };

  const handleLevelSelect = (section: QuizSection) => {
    if (currentGA < section.unlockWeek && !progress.sectionResults?.[section.id]) return;
    setSelectedSection(section);
    
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    
    const existing = progress.sectionResults?.[section.id];
    if (existing && !existing.isCompleted) {
      const idx = Math.min(existing.answeredCount || 0, section.questions.length - 1);
      setCurrentQuestionIdx(idx);
      setScore(existing.score || 0);
    } else {
      setCurrentQuestionIdx(0);
      setScore(0);

      const newResults = {
        ...(progress.sectionResults || {}),
        [section.id]: {
          score: 0,
          total: section.questions.length,
          isCompleted: false,
          answeredCount: 0
        }
      };
      
      setPatient({
        ...patient,
        quizProgress: { ...progress, sectionResults: newResults }
      });
    }
    
    setShowResult(false);
    setSelectedOption(null);
    setIsAnswered(false);
    setWrongQuestions([]);
    setIsRevisionMode(false);
    setShowBalloons(false);
  };

  const currentQuestions = isRevisionMode ? wrongQuestions : (selectedSection?.questions || []);
  const q = selectedSection ? currentQuestions[currentQuestionIdx] : null;

  useEffect(() => {
    if (selectedSection && !showResult && !q && currentQuestions.length > 0) {
      if (currentQuestionIdx >= currentQuestions.length) {
        setShowResult(true);
      } else {
        setCurrentQuestionIdx(Math.max(0, currentQuestionIdx));
      }
    }
  }, [selectedSection, q, showResult, currentQuestionIdx, currentQuestions.length]);

  if (selectedSection && !showResult && currentQuestions.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-border shadow-md text-center space-y-4">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
          <TrophyIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-dark">ጥሩ ውጤት!</h2>
        <p className="text-text-muted">በዚህ ደረጃ የሚታረም ስህተት የለም።</p>
        <button 
          onClick={() => setSelectedSection(null)}
          className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all font-sans"
        >
          ወደ ደረጃዎች ተመለስ
        </button>
      </div>
    );
  }

  if (selectedSection && !showResult && !q) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-md px-6">
        <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto text-danger mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-text-muted font-medium mb-6">ጥያቄ ማግኘት አልተቻለም።</p>
        <button 
          onClick={() => setSelectedSection(null)}
          className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all font-sans"
        >
          ተመለስ
        </button>
      </div>
    );
  }

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    
    const isCorrect = index === q!.correct;
    const newScore = isCorrect ? score + 1 : score;

    if (isCorrect) {
      setScore(newScore);
      setShowBalloons(true);
      confetti({
        particleCount: 225,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8']
      });
      setTimeout(() => setShowBalloons(false), 5000);

      autoNextTimeoutRef.current = setTimeout(() => {
        nextQuestion();
      }, 3500);
    } else {
      if (!isRevisionMode) {
        setWrongQuestions(prev => [...prev, q!]);
      }
    }

    if (selectedSection && !isRevisionMode) {
      const existing = progress.sectionResults?.[selectedSection.id];
      if (!existing?.isCompleted) {
        const newResults = {
          ...(progress.sectionResults || {}),
          [selectedSection.id]: {
            score: newScore,
            total: selectedSection.questions.length,
            isCompleted: false,
            answeredCount: currentQuestionIdx + 1
          }
        };
        setPatient({
          ...patient,
          quizProgress: { ...progress, sectionResults: newResults }
        });
      }
    }
  };

  const nextQuestion = () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }

    if (currentQuestionIdx + 1 < currentQuestions.length) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      if (selectedSection) {
        if (isRevisionMode) {
          setSelectedSection(null);
          setIsRevisionMode(false);
          return;
        }

        const newSectionResults = {
          ...(progress.sectionResults || {}),
          [selectedSection.id]: {
            score: score,
            total: selectedSection.questions.length,
            isCompleted: true,
            answeredCount: selectedSection.questions.length
          }
        };

        const newTotalScore = Object.values(newSectionResults).reduce((sum, res) => sum + (res.isCompleted ? res.score : 0), 0);
        
        setPatient({
          ...patient,
          quizProgress: { totalScore: newTotalScore, sectionResults: newSectionResults }
        });
      }
      setSelectedSection(null);
      setIsRevisionMode(false);
    }
  };

  if (!selectedSection) {
    return (
      <div className="space-y-6">
        {showBalloons && <BalloonAnimation />}
        <div className="flex justify-between items-center px-1">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-text-dark">የእውቀት ጉዞ</h2>
            <p className="text-xs text-text-muted">ደረጃዎችን በማለፍ እውቀትዎን ያሳድጉ</p>
          </div>
          <div className="bg-primary/10 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="text-sm font-black text-primary">{progress.totalScore}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {QUIZ_DATA.map((section) => {
            const result = progress.sectionResults?.[section.id];
            const isUnlocked = currentGA >= section.unlockWeek || !!result;
            const isCompleted = result?.isCompleted || false;
            const isInProgress = result && !result.isCompleted;
            
            const percentage = result ? Math.round((result.score / result.total) * 100) : 0;
            const overallProgressPercentage = (result && !result.isCompleted) ? Math.round((result.answeredCount / result.total) * 100) : (isCompleted ? 100 : 0);
            
            const trophy = isCompleted ? getTrophyInfo(percentage) : null;

            return (
              <button
                key={section.id}
                onClick={() => handleLevelSelect(section)}
                className={cn(
                  "relative p-5 rounded-2xl border transition-all flex items-center gap-4 text-left group",
                  isUnlocked 
                    ? "bg-white border-border shadow-sm hover:shadow-md hover:border-primary active:scale-[0.98]" 
                    : "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  isCompleted ? (trophy ? trophy.bg : "bg-success/10") : 
                  isInProgress ? "bg-amber-100 text-amber-600" :
                  isUnlocked ? "bg-primary-light text-primary" : "bg-gray-200 text-gray-400"
                )}>
                  {isCompleted ? (
                    <div className="flex flex-col items-center">
                      {trophy ? <trophy.icon className={cn("w-6 h-6", trophy.color)} /> : <TrophyIcon className="w-6 h-6 text-success" />}
                      {percentage > 0 && <span className={cn("text-[9px] font-black", trophy ? trophy.color : "text-success")}>{percentage}%</span>}
                    </div>
                  ) : isInProgress ? (
                    <div className="flex flex-col items-center">
                      <RefreshCw className="w-5 h-5 animate-spin-slow" />
                      {overallProgressPercentage > 0 && <span className="text-[9px] font-black">{overallProgressPercentage}%</span>}
                    </div>
                  ) :
                   isUnlocked ? <Star className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-text-dark truncate">{section.title}</h3>
                    {isInProgress && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase">በሂደት ላይ</span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-0.5">
                    {isUnlocked ? (
                      isCompleted ? (
                        <>ውጤት፡ {result.score}/{result.total} {percentage > 0 ? `(${percentage}%)` : ''}</>
                      ) : 
                      isInProgress ? (
                        <>{result.answeredCount}/{result.total} ተመልሷል {percentage > 0 ? `(${percentage}% ትክክል)` : ''}</>
                      ) :
                      `${section.questions.length} ጥያቄዎች`
                    ) : `ከሳምንት ${section.unlockWeek} በኋላ ይከፈታል`}
                  </p>
                </div>

                {isUnlocked && <ChevronRight className="w-5 h-5 text-border group-hover:text-primary transition-colors" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const totalQCount = currentQuestions.length;
  const progressPercent = ((currentQuestionIdx + (isAnswered ? 1 : 0)) / totalQCount) * 100;

  return (
    <div className="space-y-6">
      {showBalloons && <BalloonAnimation />}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <button 
            onClick={() => {
              if (autoNextTimeoutRef.current) {
                clearTimeout(autoNextTimeoutRef.current);
                autoNextTimeoutRef.current = null;
              }
              setSelectedSection(null);
            }}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className="h-full bg-primary"
            />
          </div>
          <span className="text-[10px] font-black text-primary bg-primary-light px-2 py-1 rounded-lg">
            {currentQuestionIdx + 1} / {totalQCount}
          </span>
        </div>

        {isRevisionMode && currentQuestionIdx === 0 && !isAnswered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center gap-3"
          >
            <RefreshCw className="w-5 h-5 text-amber-600 animate-spin-slow" />
            <p className="text-xs font-bold text-amber-800">ጥቂት ስህተቶችን እናስተካክል!</p>
          </motion.div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-border shadow-sm space-y-6">
        <p className="font-bold text-base text-text-dark leading-relaxed">
          {q!.question}
        </p>

        <div className="space-y-3">
          {q!.options.map((option, idx) => {
            const isCorrect = idx === q!.correct;
            const isSelected = idx === selectedOption;
            
            let btnClass = "bg-white border-border hover:bg-gray-50";
            if (isAnswered) {
              if (isCorrect) btnClass = "bg-success/10 border-success text-success scale-[1.02]";
              else if (isSelected) btnClass = "bg-danger/10 border-danger text-danger";
              else btnClass = "bg-gray-50 border-border opacity-50";
            } else if (isSelected) {
              btnClass = "border-primary bg-primary/5 text-primary ring-1 ring-primary";
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleAnswer(idx)}
                className={cn(
                  "w-full p-4 rounded-xl border text-left text-sm font-semibold transition-all flex items-center justify-between",
                  btnClass
                )}
              >
                <span>{option}</span>
                {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-success" />}
                {isAnswered && isSelected && !isCorrect && <X className="w-5 h-5 text-danger" />}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {isAnswered && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn(
                "p-4 rounded-2xl border",
                selectedOption === q!.correct ? "bg-success/5 border-success/10" : "bg-danger/5 border-danger/10"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {selectedOption === q!.correct ? 
                  <CheckCircle2 className="w-4 h-4 text-success" /> : 
                  <AlertTriangle className="w-4 h-4 text-danger" />}
                <p className={cn("text-xs font-black uppercase tracking-widest", selectedOption === q!.correct ? "text-success" : "text-danger")}>
                  {selectedOption === q!.correct ? 'ትክክለኛ መልስ!' : 'የተሳሳተ መልስ'}
                </p>
              </div>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                <span className="font-bold text-text-dark">ማብራሪያ፡</span> {q!.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {isAnswered && (
          <button 
            onClick={nextQuestion}
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            {currentQuestionIdx + 1 === totalQCount && (!isRevisionMode && wrongQuestions.length === 0 || isRevisionMode) ? 'ጨርሻለሁ' : 
             currentQuestionIdx + 1 === totalQCount && !isRevisionMode ? 'የተሳሰቱትን አስተካክል' : 'ቀጣይ ጥያቄ'} 
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tracker View ────────────────────────────────────────────────────────────
function TrackerView({ patient, calculateGA, calculateEDD }: { patient: PatientData | null, calculateGA: any, calculateEDD: any }) {
  if (!patient) return <div className="text-center py-20 text-text-muted text-sm font-medium">እባክዎን መጀመሪያ ይመዝገቡ</div>;

  const ga = calculateGA(patient);
  const edd = calculateEDD(patient);

  const getAdviceForGA = (weeks: number) => {
    if (weeks <= 4) {
      return [
        'የመጨረሻ የወር አበባ ካየሽበት ቀን ጀምሮ፣ ከወር በኋላ ቢያንስ የሳምንቱ መጨረሻ ድረስ ጠብቀሽ የእርግዝና ምርመራ (የቤት ውስጥ ወይም በሕክምና ተቋም) ብታደርጊ የተሻለ ነው።',
      ];
    } else if (weeks <= 12) {
      return [
        'እስካሁን ጤና ተቋም ሄደው ቸክ ካልተደረጉ በቶሎ ይሂዱና ክትትል ይጀምሩ',
        'ማቅለሽለሽ ጠዋት ጠዋት ማስመለስ የድካም ስሜት እንድሁም መጠነኛ የሆድ ህመም ሊሰማዎት ይችላል።',
        'ፎሊክ አሲድ፣ ካልስየም እና ቫይታሚኖች መውሰድዎን አይርሱ',
        'ቶሎ ቶሎ ትንሽ ትንሽ ይመገቡ',
        'እየወሰዱት ያለ መድሃኒት ከነበረ ለጽንሱ አደገኛ ሊሆን ስለሚችል ሃኪም ማማከርዎን ያስታዉሱ',
        'ተደጋጋሚ ማስመለስ እንድሁም ሚንም አይነት በማሂጸን ደም መፍሰስ ካለ ሃኪምዎን ያማክሩ',
        'የቡና አወሳሰድዎን ይቀንሱ ምንም አይነት አልኮል አይጠቀሙ ማጨስ ያቁሙ',
        'አልፎ አልፎ ቀጠን ያለ የዝንጅብል ሻይ መጠቀም ማስመለስን ይቀንሳል',
        'መጠነኛ የሆነ እንቅስቃሴ ማድረግ ይቻላል'
      ];
    } else if (weeks < 20) {
      return [
        'በአምስት ወር መጨረሻ አካባቢ (ከ15-20 ሳምንት) የልጁን እንቅስቃሴ መስማት ይጀምራሉ',
        'በጀርባዎ አይተኙ በጎንዎ ብቻ ለመትኛት ይሞክሩ',
        '20 ሳምንት ላይ ቀጠሮ እንዳለዎት እንዳይረሱ',
        'አይረን መውሰድ መጀመር ይኖርብዎታል',
        'እንዳስፈላጊነቱ አመጋገብዎን ይጨምሩ ኪሎዎም እየጨመረ መምጣት ይኖርበታል',
        'አደገኛ ምልክቶች ካሉ ሃኪምዎን ያማክሩ',
        'መጠነኛ የሆነ እንቅስቃሴ ማድረግ ይቻላል'
      ];
    } else if (weeks < 28) {
      return [
        'በጀርባዎ አይተኙ በጎንዎ ብቻ ለመትኛት ይሞክሩ',
        '26 ሳምንት ላይ ቀጠሮ እንዳለዎት እንዳይረሱ',
        'አይረን መውሰድ ይቀጥሉ',
        'እንዳስፈላጊነቱ አመጋገብዎን ይጨምሩ ኪሎዎም እየጨመረ መምጣት ይኖርበታል',
        'አደገኛ ምልክቶች ካሉ ሃኪምዎን ያማክሩ',
        'መጠነኛ የሆነ እንቅስቃሴ ማድረግ ይቻላል'
      ];
    } else if (weeks < 37) {
      return [
        'ይህ ጊዜ ከ ሰባት ወር በላይ ያለው የርግዝና ወቅት ሲሆን ልጁ እንዳጋጣሚ ቢወለድ ማደግ ይችላል ተብሎ ይታሰባል።',
        'የት መች እና እንዴት መውለድ እንዳለብዎት ከሃኪምዎ ጋር በደንብ ይመካከሩ።',
        '30፣ 34 ሳምንት ላይ ቀጠሮ እንዳለዎት እንዳይረሱ',
        'ዉሃ ቶሎ ቶሎ ይውሰዱ',
        'የጽንሱን እንቅስቃሴ ይከታተሉ',
        'የምጥ ምልክቶች ሊኖሩ ስለሚችሉ ልብ ብለው ይከታተሉ',
        'ድንገት ምጥ ቢጀምርዎ ወደ ጤና ተቋም ለምድረስ ትራንስፖርት አመቻችተው ይጠብቁ',
        'አደገኛ ምልክቶች ካሉ ሃኪምዎን ያማክሩ'
      ];
    } else if (weeks < 40) {
      return [
        'ይህ ጊዜ Term ወይም በናቶች አቆጣጠር 9 ወር የሚገባበት ወቅት ነው።',
        'ከዚህ ጊዜ ጀምሮ እሰከ 42ኛው ሳምንት ድረስ በማንኛውም ቀን ምጥ ሊመጣ ይችላል',
        'የምጥ ምልክቶች ሊኖሩ ስለሚችሉ ልብ ብለው ይከታተሉ',
        'የት መቼ እና እንዴት መውለድ እንዳለብዎት ከሃኪምዎ ጋር በደንብ ይመካከሩ።',
        'ድንገት ምጥ ቢጀምርዎ ወደ ጤና ተቋም ለምድረስ ትራንስፖርት አመቻችተው ይጠብቁ።',
        'የጽንሱን እንቅስቃሴ ይከታተሉ',
        'ዉሃ ቶሎ ቶሎ ይውሰዱ',
        'አደገኛ ምልክቶች ካሉ ሃኪምዎን ያማክሩ'
      ];
    } else if (weeks < 42) {
      return [
        'ይህ ጊዜ Late Term ወይም በናቶች አቆጣጠር 9 ወር የሚያልቅበት ወቅት ነው።',
        'ከአሁን በፊት ወይም ባለፈው 1 ወር ውስጥ ቼካፕ (ሀኪም ካላማከሩ) ካላደረጉ በቶሎ ወደ ተቋማችን ይምጡና ባለሙያ ያማክሩ።',
        'እሰከ 42 ኛው ሳምንት ድረስ በማንኛውም ቀን ምጥ ሊመጣ ይችላል።',
        'የምጥ ምልክቶች ሊኖሩ ስለሚችሉ ልብ ብለው ይከታተሉ',
        'የት መቼ እና እንዴት መውለድ እንዳለብዎት ከሃኪምዎ ጋር በደንብ ይመካከሩ።',
        'ድንገት ምጥ ቢጀምርዎ ወደ ጤና ተቋም ለምድረስ ትራንስፖርት አመቻችተው ይጠብቁ።',
        'የጽንሱን እንቅስቃሴ ይከታተሉ',
        'አደገኛ ምልክቶች ካሉ ሃኪምዎን ያማክሩ',
        'ዉሃ ቶሎ ቶሎ ይውሰዱ'
      ];
    } else {
      return [
        'የመውለጃ ቀንዎ አልፏል።',
        'ቀንዎን በትክክል ማስታዎስዎንና ወደመተግበሪያው በትክክል ማስገባትዎን ልብ ይበሉ።',
        'ወደ ተቋማችን በቶሎ ማለትም አሁን በመምጣት ቀንዎ ትክክል ሰለመሆኑ ማረጋገጥ ወይንም የወሊድ አገልግሎት ማግኘት ይኖርብዎታል።',
        'ልብ ይበሉ የመውለጃ ቀንዎ ካለፈ ለዕርስዎም ሆነ ለፅንሱ አደገኛ ነው።'
      ];
    }
  };

  const advices = getAdviceForGA(ga.weeks);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-primary uppercase text-[10px] tracking-widest flex items-center gap-2">
            <span>📊</span> የእርግዝና ሁኔታ
          </h3>
          <span className="px-2 py-0.5 bg-primary-light text-primary text-[10px] font-bold rounded-full">በሂደት ላይ</span>
        </div>
        <div className="flex items-baseline gap-2 justify-center py-2">
          <span className="text-7xl font-black text-primary tracking-tighter">{ga.weeks}</span>
          <span className="text-lg font-bold text-text-muted">ሳምንት</span>
          <span className="text-3xl font-bold text-primary/60 ml-1">{ga.days}</span>
          <span className="text-sm font-medium text-text-muted">ቀን</span>
        </div>
        <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">የመውለጃ ቀን (GC)</p>
            <p className="font-bold text-sm text-text-dark">{format(edd, 'MMM dd, yyyy')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">የመውለጃ ቀን (EC)</p>
            <p className="font-bold text-sm text-text-dark">{formatEC(edd)}</p>
          </div>
        </div>
      </div>

      <div className="bg-primary-light/30 p-5 rounded-2xl border border-primary-light">
        <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
          <span>💡</span> የዛሬው ምክር
        </h4>
        <ul className="space-y-2">
          {advices.map((advice: string, idx: number) => (
            <li key={idx} className="text-sm text-text-dark leading-relaxed font-medium flex gap-2">
              <span className="text-primary mt-1">•</span>
              <span>{advice}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Other Views (unchanged) ─────────────────────────────────────────────────
function PrePregnancyView() {
  const items = [
    'ከትዳር አጋር ጋር መመካከር',
    'የእርግዝና መከላከያ ማቆም',
    'ቫይታሚኖችን መውሰድ',
    'የሰውነትን ክብደት ማስተካከል',
    'አመጋገብን ማስተካከል',
    'የአካል ብቃት እንቅስቃሴ ማድረግ',
    'ጎጂ ከሆኑ ሱሶች መላቀቅ',
    'የኤች እይ ቪ እና የጉበት ቫይረስ ምርመራ ማድረግ'
  ];
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">ከእርግዝና በፊት</h2>
      <div className="grid grid-cols-1 gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-border shadow-sm">
            <CheckCircle2 className="text-primary w-4 h-4 shrink-0" />
            <span className="text-text-dark font-semibold text-sm">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SymptomsView() {
  const symptoms = [
    'ማቅለሽለሽና ማስታወክ',
    'እንቅልፍ ማጣት እና ድብታ',
    'ጣዕም ምርጫዎችን መለወጥ',
    'ከመጠን በላይ ምራቅ',
    'ድካም',
    'የሽንት ቶሎ ቶሎ መምጣት',
    'የጡት እብጠት',
    'ዝቅተኛ ራስ ምታት',
    'ዝቅተኛ የጀርባ ምቾት ማጣት',
    'ትንሽ የማህጸን ደም መፍሰስ (Spotting)',
    'መሰረታዊ የሙቀት መጠን መጨመር',
    'የፅንስ እንቅስቃሴ',
    'የክብደት መጨመር',
    'የቆዳ ቀለም ለውጥ',
    'የቆዳ ሸንተረር',
    'የእግር እብጠት (መጠነኛ የሆነ)',
    'የማህፀን መጨመር',
    'የልብ ምት መጨመር'
  ];
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">የእርግዝና ምልክቶች</h2>
      <div className="grid grid-cols-2 gap-2">
        {symptoms.map((s, i) => (
          <div key={i} className="p-3 bg-white rounded-xl border border-border text-text-dark text-xs font-medium shadow-sm">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function DangerSignsView() {
  const signs = [
    'ከፍተኛ ራስ ምታት (ማስታገሻ የማይመልሰው)',
    'የዓይን ብዥታ',
    'የቀኝ የላይኛው ሆድ ክፍል ህመም',
    'ከማህጸን ደም መፍሰስ',
    'የእንሽርት ውሃ መፍሰስ',
    'የፅንስ እንቅስቃሴ መቀነስ',
    'በተደጋጋሚ ማስመለስ',
    'ከፍተኛ የሆድ ህመም',
    'የእጅ ፣ የፊት እንዲሁም የእግር እብጠት',
    'ትኩሳት'
  ];
  return (
    <div className="space-y-6">
      <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-center gap-3">
        <AlertTriangle className="text-danger w-6 h-6 shrink-0" />
        <p className="text-danger font-bold text-xs">እነዚህ ምልክቶች ከታዩ ወደ ጤና ተቋም በቶሎ መሄድ ያስፈልጋል፡፡</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {signs.map((s, i) => (
          <div key={i} className="p-3.5 bg-white rounded-xl border-l-4 border-l-danger border-y border-r border-border shadow-sm font-bold text-sm text-text-dark">
            {s}
          </div>
        ))}
      </div>
      <button className="w-full py-4 bg-danger text-white font-bold rounded-xl shadow-lg shadow-danger/20 flex items-center justify-center gap-2">
        ከላይ የተጠቀሱትን ምልክቶች ካዩ, በአቅራቢያዎ ወደሚገኝ የጤና ተቋም በፍጥነት ይሂዱ::
      </button>
    </div>
  );
}

function TestingView() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">የእርግዝና ምርመራ</h2>
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm leading-relaxed text-sm text-text-dark font-medium">
        <p>
          የመጨረሻ የወር አበባ ካየሽበት ቀን ጀምሮ፣ ከወር በኋላ ቢያንስ የሳምንቱ መጨረሻ ድረስ ጠብቀሽ የእርግዝና ምርመራ (የቤት ውስጥ ወይም በሕክምና ተቋም) ብታደርጊ የተሻለ ነው።
        </p>
      </div>
    </div>
  );
}

function GeneralInfoView() {
  const sections = [
    { title: 'የእርግዝና ክትትል', content: 'በእርግዝና ወቅት በቂ የእርግዝና ክትትል ማድረግ አስፈላጊ ነው፡፡' },
    { title: 'አይረን እና ፎሊክ አሲድ', content: 'ፎሊክ አሲድ ከአፈጣጠር ጋር ተያይዞ የሚመጡ የአከርካሪ አጥንት ክፍተት (Neural tube defect) በከፍተኛ ሁኔታ ይከላከላል፡፡ ከእርግዝና 3 ወር በፊት ጀምሮ ቢወሰድ ተመራጭ ነው፡፡ አይረን የጨጓራ የማቃጠል ስሜት እስካላመጣ ድረስ መውሰድ ያስፈልጋል፡፡' },
    { title: 'የደም አይነት', content: 'የእናት እና የልጅ የደም አይነት (Rh factor) የተለያየ ከሆነ ለሾተላይ ተጋላጭ ያደርጋል፡፡ ይህን ለመከላከል ANTI D የተባለ መድሃኒት 28 ሳምንት ላይ እና ከወሊድ በኋላ በሃኪም ትእዛዝ መውሰድ ይኖርባታል፡፡' },
    { title: 'መድኃኒቶች', content: 'ለህመም ማስታገሻ ተብለው የሚወሰዱ መድኃኒቶችን ያለ ሀኪም ትዕዛዝ አለመውሰድ፡፡ እነዚህ መድኃኒቶች ወደ ጽንስ በመሄድ ጉዳት (ውርጃ እና የአፈጣጠር ችግር) ሊያደርሱ ይችላሉ፡፡' },
    { title: 'አተኛኘት', content: 'በሦስተኛው የእርግዝና ክፍለ ጊዜ በጀርባ አለመተኛት፡፡ በጀርባሽ የምትተኝ ከሆነ ወደ ልጅሽ የሚሄደው የደም ዝውውር ሊቀንስ ይችላል። በመጨረሻዎቹ ሶስት ወራት በጎን በኩል መተኛት ፅንሱ ሞቶ እንዳይወለድ ይረዳል፡፡ ትራስ በጀርባዎ በኩል መደራረብ በጎን በኩል እንዲተኙ ያግዝዎታል።' },
    { title: 'አመጋገብ', content: 'ምግብሽን ሳታበስይ አለመመገብ፡፡ የበሰሉ ምግቦችን መጠቀም አስፈላጊ ነው፡፡ የተመጣጠኑ ምግቦችን (ስጋ፣ እንቁላል፣ የወተት ውጤቶች፣ አሳ፣ ዳቦ፣ ድንች፣ በቆሎ፣ ሩዝ፣ ቅቤ፣ ዘይት፣ አትክልትና ፍራፍሬዎች) መውሰድ ተገቢ ነው፡፡' },
    { title: 'ክብደት', content: 'በእርግዝና ወቅት በቂ ክብደት መጨመር ይኖርብሻል።' }
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-text-dark">አጠቃላይ መረጃዎች</h2>
      {sections.map((s, i) => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-border shadow-sm space-y-2">
          <h3 className="font-bold text-sm text-primary flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            {s.title}
          </h3>
          <p className="text-xs text-text-muted leading-relaxed font-medium">{s.content}</p>
        </div>
      ))}
    </div>
  );
}

function LaborSignsView() {
  const signs = [
    'ከባድ የሆድ ቁርጠት',
    'ከማህጸን የሚወርድ ደም የቀላቀለ ዝልግልግ ፈሳሽ',
    'የጀርባ የታችኛው ክፍል ህመም',
    'ከማህጸን ወደታች የመጫን ስሜት',
    'የእንሽርት ውሃ መፍሰስ'
  ];
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">የምጥ ምልክቶች</h2>
      <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl flex items-center gap-3">
        <Baby className="text-warning w-6 h-6 shrink-0" />
        <p className="text-warning font-bold text-xs">እነዚህ ምልክቶች ሲታዩ ወደ ጤና ተቋም በቶሎ መሄድ ያስፈልጋል፡፡</p>
      </div>
      <div className="space-y-2">
        {signs.map((s, i) => (
          <div key={i} className="p-4 bg-white rounded-xl border border-border shadow-sm font-bold text-sm text-text-dark flex items-center gap-3">
            <div className="w-2 h-2 bg-warning rounded-full" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function PostnatalView() {
  const steps = [
    'ትንሽ ትንሽ በማህጸን ደም መፍሰስ ይኖራል',
    'መጠነኛ የሆድ ህመም አለ',
    'ቶሎ ቶሎ መንቀሳቀስዎን አይርሱ',
    'ስለጡት አመጋግብ በቂ ምክር ያግኙ',
    'በማህጸን ላይ ስቲች ካለ በቀን 3 ጊዜ በቀዝቃዛ ዉሃ መዘፍዘፍዎን አይርሱ',
    'አይረን እንደ ሃኪሙ ትዛዝ መውሰድ መቀጠልዎን እንዳይረሱ (ከ 1 ወር እስከ 3ወር ድረስ)'
  ];

  const dangerSigns = [
    'መጠኑ በዛ ያለ ደም መፍሰስ',
    'ራስ ምታት',
    'አይን ብዥ ብዥ ማለት',
    'የሰውነት እብጠት',
    'የህጻኑ አተነፋፈስ መጨመር ዎይም መጥባት ማቆም ወይም የህጻኑ ትኩሳት መጨመር'
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-dark">የድህረ ወሊድ አገግሎቶች</h2>
      
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-primary">የመጀምሪያው 1 ቀን</h3>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="p-4 bg-white rounded-xl border border-border shadow-sm font-bold text-sm text-text-dark flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
              {s}
            </div>
          ))}
        </div>
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
          <p className="text-primary font-bold text-sm text-center">ከወለዱ 1 ሳምንት በኋላ ወደጤና ተቋም ሂደው ክትትል ማድረግዎን ያስታዉሱ</p>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="font-bold text-lg text-danger flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          የድህረ ወሊድ አደገኛ ምልክቶች
        </h3>
        <div className="space-y-2">
          {dangerSigns.map((s, i) => (
            <div key={i} className="p-4 bg-danger/5 rounded-xl border border-danger/20 font-bold text-sm text-danger flex items-start gap-3">
              <div className="w-2 h-2 bg-danger rounded-full shrink-0 mt-1.5" />
              {s}
            </div>
          ))}
        </div>
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl">
          <p className="text-danger font-bold text-sm text-center">እነዚህ እና ሌሎችም ምልክቶች ካሉ ቶሎ ወደጤና ተቋም ይሂዱ።</p>
        </div>
      </div>
    </div>
  );
}
