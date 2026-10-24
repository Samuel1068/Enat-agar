import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Calendar, 
  Clock, 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Phone, 
  Edit3, 
  Save, 
  Send, 
  Heart, 
  ShieldAlert, 
  Activity, 
  FileText,
  KeyRound,
  Filter
} from 'lucide-react';
import { api } from '../api';
import { User, ClinicianPatientSummary, AppointmentRecord, ReminderRecord } from '../types';
import { EthiopianDatePicker } from './EthiopianDatePicker';
import { formatEC } from '../lib/ethiopian-calendar';

interface ClinicianDashboardProps {
  currentUser: User;
  onSelectPatientForView?: (patient: any) => void;
}

export const ClinicianDashboard: React.FC<ClinicianDashboardProps> = ({ currentUser, onSelectPatientForView }) => {
  const [patients, setPatients] = useState<ClinicianPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'credentials' | 'new'>('credentials');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientDetails, setPatientDetails] = useState<{
    patient: any;
    appointments: AppointmentRecord[];
    reminders: ReminderRecord[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Forms state
  const [credPhone, setCredPhone] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credNotes, setCredNotes] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // New patient registration form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newLnmp, setNewLnmp] = useState<string>(new Date().toISOString());
  const [newBloodType, setNewBloodType] = useState('O+');
  const [newRhFactor, setNewRhFactor] = useState('+');
  const [newRiskNotes, setNewRiskNotes] = useState('');

  // Reminder form
  const [reminderTitle, setReminderTitle] = useState('የቀጠሮ ማሳሰቢያ');
  const [reminderMessage, setReminderMessage] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  // Edit patient profile form
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editRiskNotes, setEditRiskNotes] = useState('');
  const [editBloodType, setEditBloodType] = useState('');
  const [editRhFactor, setEditRhFactor] = useState('');

  // Missed appointment modal
  const [missedApptModal, setMissedApptModal] = useState<{
    show: boolean;
    week: number;
    appointmentId?: number;
    description: string;
    appointmentDate: string;
  } | null>(null);
  const [missedReason, setMissedReason] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const res = await api.getClinicianPatients();
      setPatients(res.patients || []);
    } catch (err: any) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPatient = async (id: number) => {
    setSelectedPatientId(id);
    setLoadingDetails(true);
    setIsEditingProfile(false);
    try {
      const data = await api.getPatientDetails(id);
      setPatientDetails(data);
      setEditRiskNotes(data.patient?.risk_notes || '');
      setEditBloodType(data.patient?.blood_type || '');
      setEditRhFactor(data.patient?.rh_factor || '');
    } catch (err: any) {
      console.error('Failed to get patient details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddByCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await api.addPatientByCredentials(credPhone, credPassword, credNotes);
      setAddSuccess(res.message);
      setCredPhone('');
      setCredPassword('');
      setCredNotes('');
      await loadPatients();
      setTimeout(() => setShowAddModal(false), 1500);
    } catch (err: any) {
      setAddError(err.message || 'ታካሚውን ማገናኘት አልተቻለም');
    }
  };

  const handleRegisterNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await api.registerNewPatient({
        name: newName,
        phone: newPhone,
        age: newAge,
        id_number: newIdNumber,
        lnmp: newLnmp,
        blood_type: newBloodType,
        rh_factor: newRhFactor,
        risk_notes: newRiskNotes
      });
      setAddSuccess('አዲስ ታካሚ በተሳካ ሁኔታ ተመዝግቧል');
      setNewName('');
      setNewPhone('');
      setNewAge('');
      setNewIdNumber('');
      setNewRiskNotes('');
      await loadPatients();
      setTimeout(() => setShowAddModal(false), 1500);
    } catch (err: any) {
      setAddError(err.message || 'ታካሚውን መመዝገብ አልተቻለም');
    }
  };

  const handleSaveProfileChanges = async () => {
    if (!selectedPatientId) return;
    try {
      await api.updatePatientProfile(selectedPatientId, {
        blood_type: editBloodType,
        rh_factor: editRhFactor,
        risk_notes: editRiskNotes
      });
      setIsEditingProfile(false);
      await handleOpenPatient(selectedPatientId);
      await loadPatients();
    } catch (err: any) {
      alert(err.message || 'መረጃውን ማዘመን አልተቻለም');
    }
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !reminderMessage.trim()) return;
    setSendingReminder(true);
    try {
      await api.sendReminder(selectedPatientId, {
        title: reminderTitle,
        message: reminderMessage,
        reminder_type: 'appointment'
      });
      setReminderMessage('');
      alert('የቀጠሮ ማሳሰቢያው ለታካሚው በተሳካ ሁኔታ ተልኳል!');
      await handleOpenPatient(selectedPatientId);
    } catch (err: any) {
      alert(err.message || 'ማሳሰቢያ መላክ አልተቻለም');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleMarkAppointmentStatus = async (status: 'completed' | 'missed' | 'scheduled') => {
    if (!missedApptModal || !selectedPatientId) return;
    try {
      await api.updateAppointmentStatus(selectedPatientId, {
        appointmentId: missedApptModal.appointmentId,
        week: missedApptModal.week,
        appointmentDate: missedApptModal.appointmentDate,
        description: missedApptModal.description,
        status,
        missedReason: status === 'missed' ? missedReason : undefined
      });
      setMissedApptModal(null);
      setMissedReason('');
      await handleOpenPatient(selectedPatientId);
    } catch (err: any) {
      alert(err.message || 'የቀጠሮ ሁኔታ መቀየር አልተቻለም');
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm) ||
    (p.id_number && p.id_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-primary text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>የጤና ባለሙያ ፖርታል (Clinician Portal)</span>
            </div>
            <h2 className="text-2xl font-bold">{currentUser.name}</h2>
            <p className="text-sm text-emerald-100 mt-0.5">
              {currentUser.specialty || 'Maternal Health Specialist'} &bull; {currentUser.facility_name || 'Health Facility'}
            </p>
          </div>

          <button
            onClick={() => { setShowAddModal(true); setAddError(null); setAddSuccess(null); }}
            className="self-start md:self-auto bg-white text-emerald-800 hover:bg-emerald-50 px-5 py-3 rounded-2xl font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>ታካሚ ጨምር (Add Patient)</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">የተመዘገቡ ታካሚዎች</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{patients.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">ንቁ ክትትሎች</div>
          <div className="text-2xl font-extrabold text-primary mt-1">
            {patients.filter(p => (p.ga_weeks || 0) < 42).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-gray-500 font-medium">ከፍተኛ ጥንቃቄ የሚሹ</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">
            {patients.filter(p => !!p.risk_notes).length}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="በስም፣ በስልክ ቁጥር ወይም በመለያ ቁጥር ፈልግ..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Patients Roster List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            የታካሚዎች ዝርዝር ({filteredPatients.length})
          </h3>
        </div>

        {loading ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400">
            መረጃዎችን በማምጣት ላይ...
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 space-y-3">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="font-medium text-sm">ምንም የተመዘገበ ታካሚ አልተገኘም</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              የታካሚውን ስልክ ቁጥር እና የይለፍ ቃል በመጠቀም ወደ ክትትል ዝርዝርዎ ማካተት ይችላሉ።
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              አሁን ጨምር
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPatients.map((patient) => {
              // Calculate GA if LNMP exists
              let gaDisplay = `${patient.ga_weeks || 0} ሳምንት`;
              if (patient.lnmp) {
                const diffDays = Math.floor((new Date().getTime() - new Date(patient.lnmp).getTime()) / (1000 * 3600 * 24));
                const weeks = Math.floor(diffDays / 7);
                const days = diffDays % 7;
                gaDisplay = `${weeks} ሳምንት ከ ${days} ቀን`;
              }

              return (
                <div
                  key={patient.id}
                  onClick={() => handleOpenPatient(patient.id)}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {patient.name}
                        </span>
                        {patient.age && (
                          <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {patient.age} ዓመት
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{patient.phone}</span>
                        {patient.id_number && (
                          <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-md border border-gray-100">
                            ID: {patient.id_number}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-emerald-100 text-right">
                      {gaDisplay}
                    </div>
                  </div>

                  {patient.risk_notes && (
                    <div className="p-2 bg-amber-50 text-amber-800 text-[11px] rounded-xl border border-amber-100 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{patient.risk_notes}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                    <span>ደም፡ <strong>{patient.blood_type || 'ያልተገለጸ'}</strong></span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      ክትትል ክፈት <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Add Patient (By Phone + Password OR Register New) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col"
            >
              <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-300" />
                  <h3 className="font-bold text-base">ታካሚ ወደ ክትትል ዝርዝር ጨምር</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                {/* Mode Selector */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setAddMode('credentials'); setAddError(null); setAddSuccess(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      addMode === 'credentials' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    በስልክ እና የይለፍ ቃል (Existing)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddMode('new'); setAddError(null); setAddSuccess(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      addMode === 'new' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    አዲስ መመዝገቢያ (Register New)
                  </button>
                </div>

                {addError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                {addSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs flex items-center gap-2 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{addSuccess}</span>
                  </div>
                )}

                {addMode === 'credentials' ? (
                  <form onSubmit={handleAddByCredentials} className="space-y-3.5">
                    <div className="p-3 bg-emerald-50/60 rounded-xl text-xs text-emerald-900 border border-emerald-100 leading-relaxed">
                      💡 <strong>የታካሚውን ፈቃድ ማረጋገጫ፡</strong> የታካሚውን ስልክ ቁጥር እና የመግቢያ የይለፍ ቃል በማስገባት ወደ እርስዎ የክትትል ዝርዝር ያካትቱ።
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        የታካሚው ስልክ ቁጥር (Phone Number) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={credPhone}
                        onChange={(e) => setCredPhone(e.target.value)}
                        placeholder="0933000000"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        የታካሚው የይለፍ ቃል (Password) *
                      </label>
                      <input
                        type="password"
                        required
                        value={credPassword}
                        onChange={(e) => setCredPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        የመነሻ ማስታወሻ (Clinical Notes - Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={credNotes}
                        onChange={(e) => setCredNotes(e.target.value)}
                        placeholder="የታካሚው ሁኔታ ወይም የክሊኒክ ማስታወሻ..."
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>ታካሚውን አገናኝ (Link Patient)</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterNewPatient} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">ሙሉ ስም *</label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="ለምሳሌ፡ ጽዮን ተስፋዬ"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">ስልክ ቁጥር *</label>
                        <input
                          type="tel"
                          required
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="0911..."
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">እድሜ</label>
                        <input
                          type="number"
                          value={newAge}
                          onChange={(e) => setNewAge(e.target.value)}
                          placeholder="24"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">መለያ ቁጥር (ID Number)</label>
                      <input
                        type="text"
                        value={newIdNumber}
                        onChange={(e) => setNewIdNumber(e.target.value)}
                        placeholder="የሆስፒታል ካርድ ቁጥር"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">የመጨረሻ የወር አበባ (LNMP)</label>
                      <EthiopianDatePicker
                        value={newLnmp}
                        onChange={(iso) => setNewLnmp(iso)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">የደም አይነት</label>
                        <select
                          value={newBloodType}
                          onChange={(e) => setNewBloodType(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
                        >
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rh Factor</label>
                        <select
                          value={newRhFactor}
                          onChange={(e) => setNewRhFactor(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
                        >
                          <option value="+">ፖዘቲቭ (+)</option>
                          <option value="-">ኔጌቲቭ (-)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">የጤና ሁኔታ ማስታወሻ</label>
                      <textarea
                        rows={2}
                        value={newRiskNotes}
                        onChange={(e) => setNewRiskNotes(e.target.value)}
                        placeholder="አለርጂ፣ ግፊት፣ ስኳር..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer"
                    >
                      ታካሚውን መዝግብ (Register & Assign)
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Patient Detailed Profile & Clinical Follow-up */}
      <AnimatePresence>
        {selectedPatientId && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-gray-100"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    {patientDetails?.patient?.name || 'የታካሚ ክትትል ዝርዝር'}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    ስልክ፡ {patientDetails?.patient?.phone} {patientDetails?.patient?.id_number && `• ID: ${patientDetails?.patient?.id_number}`}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedPatientId(null); setPatientDetails(null); }}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {loadingDetails ? (
                  <div className="p-12 text-center text-gray-400">መረጃዎችን በማምጣት ላይ...</div>
                ) : (
                  <>
                    {/* Patient Overview Box */}
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          የእርግዝና መረጃ (Pregnancy Profile)
                        </span>
                        <button
                          onClick={() => setIsEditingProfile(!isEditingProfile)}
                          className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isEditingProfile ? 'ሰርዝ' : 'መረጃ አሻሽል (Edit)'}
                        </button>
                      </div>

                      {isEditingProfile ? (
                        <div className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">የደም አይነት</label>
                              <input
                                type="text"
                                value={editBloodType}
                                onChange={(e) => setEditBloodType(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Rh Factor</label>
                              <input
                                type="text"
                                value={editRhFactor}
                                onChange={(e) => setEditRhFactor(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">የጥንቃቄ ማስታወሻ (Risk Notes)</label>
                            <textarea
                              rows={2}
                              value={editRiskNotes}
                              onChange={(e) => setEditRiskNotes(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                            />
                          </div>
                          <button
                            onClick={handleSaveProfileChanges}
                            className="bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            ለውጦቹን መዝግብ (Save)
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-gray-500 block">የመጨረሻ የወር አበባ</span>
                            <span className="font-bold text-gray-800">
                              {patientDetails?.patient?.lnmp ? formatEC(new Date(patientDetails?.patient?.lnmp)) : 'ያልተገለጸ'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-gray-500 block">የእርግዝና ሳምንት</span>
                            <span className="font-bold text-emerald-700">
                              {patientDetails?.patient?.ga_weeks || 0} ሳምንት
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-gray-500 block">የደም አይነት</span>
                            <span className="font-bold text-gray-800">
                              {patientDetails?.patient?.blood_type || 'N/A'} ({patientDetails?.patient?.rh_factor || ''})
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-gray-500 block">እድሜ</span>
                            <span className="font-bold text-gray-800">
                              {patientDetails?.patient?.age || 'N/A'} ዓመት
                            </span>
                          </div>
                        </div>
                      )}

                      {patientDetails?.patient?.risk_notes && !isEditingProfile && (
                        <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span><strong>ልዩ ክትትል፡</strong> {patientDetails?.patient?.risk_notes}</span>
                        </div>
                      )}
                    </div>

                    {/* ANC Appointments Schedule & Missed Appointment Markers */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          የቅድመ ወሊድ (ANC) የቀጠሮዎች ክትትል
                        </h4>
                        <span className="text-[11px] text-gray-500">ቀጠሮውን ለማረጋገጥ ወይም እንዳመለጠ ለማመልከት ይጫኑ</span>
                      </div>

                      <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 text-xs">
                        {[12, 20, 26, 30, 34, 36, 38, 40, 41, 42].map((week) => {
                          const existingAppt = patientDetails?.appointments.find(a => a.week === week);
                          const status = existingAppt?.status || 'scheduled';

                          // Approximate appointment date based on LNMP
                          let apptDateStr = 'ተለዋዋጭ';
                          let rawDate = new Date();
                          if (patientDetails?.patient?.lnmp) {
                            rawDate = new Date(patientDetails?.patient?.lnmp);
                            rawDate.setDate(rawDate.getDate() + week * 7);
                            apptDateStr = formatEC(rawDate);
                          }

                          return (
                            <div key={week} className="p-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3">
                              <div>
                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                  <span>ሳምንት {week} ክትትል</span>
                                  {status === 'completed' && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ተጠናቋል
                                    </span>
                                  )}
                                  {status === 'missed' && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-red-600" /> አምልጧል (Missed)
                                    </span>
                                  )}
                                  {status === 'scheduled' && (
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                                      በመጠባበቅ ላይ
                                    </span>
                                  )}
                                </div>
                                <div className="text-gray-500 text-[11px] mt-0.5">
                                  ቀን፡ {apptDateStr} {existingAppt?.missed_reason && `• ምክንያት፡ ${existingAppt.missed_reason}`}
                                </div>
                              </div>

                              {/* Status Action Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => {
                                    setMissedApptModal({
                                      show: true,
                                      week,
                                      appointmentId: existingAppt?.id,
                                      description: `${week}ኛው ሳምንት ክትትል`,
                                      appointmentDate: rawDate.toISOString()
                                    });
                                  }}
                                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-all text-[11px] cursor-pointer"
                                >
                                  ሁኔታ ቀይር
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Send Reminder to Patient */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                      <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                        <Bell className="w-4 h-4 text-emerald-600" />
                        ለታካሚው መልዕክት ወይም የቀጠሮ ማሳሰቢያ ይላኩ (Send Reminder)
                      </h4>

                      <form onSubmit={handleSendReminder} className="space-y-2.5">
                        <input
                          type="text"
                          required
                          value={reminderTitle}
                          onChange={(e) => setReminderTitle(e.target.value)}
                          placeholder="የማሳሰቢያው ርዕስ (ለምሳሌ፡ የቀጠሮ ማሳሰቢያ)"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white"
                        />
                        <textarea
                          rows={2}
                          required
                          value={reminderMessage}
                          onChange={(e) => setReminderMessage(e.target.value)}
                          placeholder="መልዕክትዎን እዚህ ይጻፉ (ለምሳሌ፡ ነገ ጠዋት የደም ምርመራ ቀጠሮ ስላለዎት በሰዓቱ ይገኙ)..."
                          className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white"
                        />
                        <button
                          type="submit"
                          disabled={sendingReminder}
                          className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{sendingReminder ? 'በመላክ ላይ...' : 'ማሳሰቢያ ላክ (Send to Patient)'}</span>
                        </button>
                      </form>

                      {/* Previous Reminders */}
                      {patientDetails?.reminders && patientDetails.reminders.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">የተላኩ የቀድሞ መልዕክቶች፡</span>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {patientDetails.reminders.map((r) => (
                              <div key={r.id} className="p-2 bg-white rounded-lg border border-gray-200 text-[11px]">
                                <div className="font-bold text-gray-800">{r.title}</div>
                                <div className="text-gray-600">{r.message}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Mark Missed Appointment / Reason */}
      <AnimatePresence>
        {missedApptModal && (
          <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-gray-900">የቀጠሮ ሁኔታ ማዘመኛ</h4>
                <button onClick={() => setMissedApptModal(null)}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <p className="text-xs text-gray-600">
                ለሳምንት <strong>{missedApptModal.week}</strong> ክትትል የታካሚውን ሁኔታ ይምረጡ፡
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ቀጠሮው ካመለጠ ምክንያቱ (Missed Reason - Optional)
                </label>
                <input
                  type="text"
                  value={missedReason}
                  onChange={(e) => setMissedReason(e.target.value)}
                  placeholder="ለምሳሌ፡ የትራንስፖርት እጥረት / ህመም / ሌላ"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleMarkAppointmentStatus('completed')}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  ቀጠሮው ተሳክቷል (Mark Completed)
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkAppointmentStatus('missed')}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <AlertTriangle className="w-4 h-4" />
                  ቀጠሮው አምልጧል (Mark Missed)
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkAppointmentStatus('scheduled')}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  ወደ መደበኛ ቀጠሮ መልስ (Reset to Scheduled)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
