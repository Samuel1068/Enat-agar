import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  Stethoscope, 
  AlertTriangle, 
  Calendar, 
  UserPlus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Phone, 
  Building2, 
  Activity, 
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  X
} from 'lucide-react';
import { api } from '../api';
import { User, AdminStats } from '../types';
import { formatEC } from '../lib/ethiopian-calendar';

interface AdminDashboardProps {
  currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'patients' | 'clinicians'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [clinicians, setClinicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Expanded clinician dropdown
  const [expandedClinicianId, setExpandedClinicianId] = useState<number | null>(null);

  // New clinician modal
  const [showAddClinicianModal, setShowAddClinicianModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('clinician123');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('Midwife Specialist');
  const [newFacility, setNewFacility] = useState('Addis Ababa Health Center');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, patientsRes, cliniciansRes] = await Promise.all([
        api.getAdminOverview().catch(() => ({ stats: { totalPatients: 0, totalClinicians: 0, missedAppointments: 0, scheduledAppointments: 0 } })),
        api.getAllPatients().catch(() => ({ patients: [] })),
        api.getAllClinicians().catch(() => ({ clinicians: [] }))
      ]);

      setStats(statsRes.stats);
      setPatients(patientsRes.patients || []);
      setClinicians(cliniciansRes.clinicians || []);
    } catch (err: any) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClinician = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    try {
      await api.createClinician({
        phone: newPhone,
        name: newName,
        password: newPassword,
        id_number: newIdNumber || undefined,
        specialty: newSpecialty,
        facility_name: newFacility
      });

      setFormSuccess('የጤና ባለሙያ አካውንት በተሳካ ሁኔታ ተፈጥሯል!');
      setNewPhone('');
      setNewName('');
      await loadData();
      setTimeout(() => setShowAddClinicianModal(false), 1500);
    } catch (err: any) {
      setFormError(err.message || 'አካውንቱን መፍጠር አልተቻለም');
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm) ||
    (p.id_number && p.id_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredClinicians = clinicians.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.facility_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Admin Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-primary text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              <span>ዋና አስተዳዳሪ ፖርታል (System Administration)</span>
            </div>
            <h2 className="text-2xl font-bold">{currentUser.name}</h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              ሁሉንም ታካሚዎች፣ ባለሙያዎች እና የቀጠሮ መረጃዎችን መቆጣጠሪያ
            </p>
          </div>

          <button
            onClick={() => { setShowAddClinicianModal(true); setFormError(null); setFormSuccess(null); }}
            className="self-start md:self-auto bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-2xl font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>አዲስ ባለሙያ መዝግብ (Add Clinician)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'overview' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          አጠቃላይ እይታ (Overview)
        </button>
        <button
          onClick={() => setActiveTab('patients')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'patients' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          ሁሉም ታካሚዎች ({patients.length})
        </button>
        <button
          onClick={() => setActiveTab('clinicians')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'clinicians' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          የጤና ባለሙያዎች ({clinicians.length})
        </button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2">
                <span>ጠቅላላ ታካሚዎች</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{stats?.totalPatients ?? patients.length}</div>
              <div className="text-[11px] text-gray-400 mt-1">በሲስተሙ የተመዘገቡ እናቶች</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2">
                <span>የጤና ባለሙያዎች</span>
                <Stethoscope className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{stats?.totalClinicians ?? clinicians.length}</div>
              <div className="text-[11px] text-gray-400 mt-1">አዋላጆችና ዶክተሮች</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2">
                <span>ያመለጡ ቀጠሮዎች</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-3xl font-extrabold text-red-600">{stats?.missedAppointments ?? 0}</div>
              <div className="text-[11px] text-red-400 mt-1">ልዩ ክትትል የሚሹ</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2">
                <span>ቀጣይ ቀጠሮዎች</span>
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{stats?.scheduledAppointments ?? 0}</div>
              <div className="text-[11px] text-gray-400 mt-1">የታቀዱ የANC ቀጠሮዎች</div>
            </div>
          </div>

          {/* Quick Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                በቅርብ የተመዘገቡ ታካሚዎች
              </h4>
              <div className="divide-y divide-gray-100 text-xs">
                {patients.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900">{p.name}</span>
                      <span className="text-gray-500 ml-2">{p.phone}</span>
                    </div>
                    <span className="text-primary font-bold">{p.ga_weeks || 0} ሳምንት</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-emerald-600" />
                ባለሙያዎች እና የታካሚ ብዛት
              </h4>
              <div className="divide-y divide-gray-100 text-xs">
                {clinicians.slice(0, 4).map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900">{c.name}</span>
                      <span className="text-gray-500 block text-[11px]">{c.facility_name}</span>
                    </div>
                    <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg">
                      {c.patient_count || 0} ታካሚዎች
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patients Tab Content */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ሁሉንም ታካሚዎች በስም፣ በስልክ ወይም በመለያ ቁጥር ፈልግ..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 font-bold text-sm text-gray-800">
              የታካሚዎች ዝርዝር ማውጫ ({filteredPatients.length})
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">የታካሚ ስም</th>
                    <th className="p-3.5">ስልክ ቁጥር</th>
                    <th className="p-3.5">እድሜ</th>
                    <th className="p-3.5">የእርግዝና ሳምንት</th>
                    <th className="p-3.5">የተመደበለት ባለሙያ</th>
                    <th className="p-3.5">ልዩ ሁኔታ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPatients.map((p) => {
                    const clinicianNames = p.clinicians?.map((c: any) => c.name).join(', ') || 'አልተመደበም';
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900">{p.name}</td>
                        <td className="p-3.5 text-gray-600">{p.phone}</td>
                        <td className="p-3.5 text-gray-600">{p.age ? `${p.age} ዓመት` : '-'}</td>
                        <td className="p-3.5 font-bold text-primary">{p.ga_weeks || 0} ሳምንት</td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                            <Stethoscope className="w-3 h-3 text-emerald-600" />
                            {clinicianNames}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {p.risk_notes ? (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium text-[11px] inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              {p.risk_notes}
                            </span>
                          ) : (
                            <span className="text-gray-400">መደበኛ</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Clinicians Tab Content */}
      {activeTab === 'clinicians' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ባለሙያዎችን በስም ወይም በሆስፒታል ፈልግ..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredClinicians.map((clinician) => {
              const isExpanded = expandedClinicianId === clinician.id;
              const clinicianPatients: any[] = clinician.patients || [];

              return (
                <div key={clinician.id} className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                  <div 
                    onClick={() => setExpandedClinicianId(isExpanded ? null : clinician.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                        <Stethoscope className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{clinician.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{clinician.specialty}</span> &bull; 
                          <span>{clinician.facility_name}</span> &bull; 
                          <span className="font-mono">{clinician.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-100">
                        {clinicianPatients.length} ታካሚዎች
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expandable Patient Roster Under This Clinician */}
                  {isExpanded && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-2">
                      <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        የባለሙያው የክትትል ዝርዝር ታካሚዎች ({clinicianPatients.length}):
                      </div>
                      {clinicianPatients.length === 0 ? (
                        <div className="text-xs text-gray-400 italic py-2">
                          ለዚህ ባለሙያ እስካሁን የተመደበ ታካሚ የለም።
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {clinicianPatients.map((pat: any) => (
                            <div key={pat.id} className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs flex items-center justify-between">
                              <div>
                                <span className="font-bold text-gray-900">{pat.name}</span>
                                <span className="text-gray-500 block text-[11px]">{pat.phone}</span>
                              </div>
                              <span className="text-emerald-700 font-bold text-[11px]">
                                {pat.age ? `${pat.age} ዓመት` : 'ንቁ'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Clinician Modal */}
      <AnimatePresence>
        {showAddClinicianModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-emerald-600" />
                  አዲስ የጤና ባለሙያ መዝግብ
                </h3>
                <button onClick={() => setShowAddClinicianModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs">{formError}</div>
              )}
              {formSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs">{formSuccess}</div>
              )}

              <form onSubmit={handleCreateClinician} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">ሙሉ ስም (Full Name) *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ለምሳሌ፡ ዶ/ር ቴዎድሮስ ካሳ"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">ስልክ ቁጥር (Phone Number) *</label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">የይለፍ ቃል (Password) *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">የሙያ ዘርፍ (Specialty)</label>
                  <input
                    type="text"
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="Midwife Specialist / Obstetrician"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">የጤና ተቋም (Health Facility)</label>
                  <input
                    type="text"
                    value={newFacility}
                    onChange={(e) => setNewFacility(e.target.value)}
                    placeholder="የሆስፒታል ወይም የጤና ጣቢያ ስም"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer mt-2"
                >
                  ባለሙያውን ፍጠር (Create Clinician Account)
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
