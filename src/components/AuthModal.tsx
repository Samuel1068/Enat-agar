import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Phone, User as UserIcon, Shield, Stethoscope, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'patient' | 'clinician' | 'admin'>('patient');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(phone, password);
        onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await api.register({
          phone,
          password,
          name,
          role,
          age: age || undefined,
          id_number: idNumber || undefined,
          specialty: specialty || undefined,
          facility_name: facilityName || undefined
        });
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'ስህተት ተከስቷል (Authentication failed)');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoPhone: string, demoPass: string) => {
    setMode('login');
    setPhone(demoPhone);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-rose-600 text-white p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                {role === 'admin' ? (
                  <Shield className="w-6 h-6 text-white" />
                ) : role === 'clinician' ? (
                  <Stethoscope className="w-6 h-6 text-white" />
                ) : (
                  <UserIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {mode === 'login' ? 'ወደ እናት አጋር ይግቡ' : 'አዲስ አካውንት ይመዝገቡ'}
                </h2>
                <p className="text-xs text-white/80">
                  {mode === 'login' ? 'Login with your phone & password' : 'Create an account to save data securely'}
                </p>
              </div>
            </div>

            {/* Quick Demo Logins Pill Box */}
            <div className="mt-4 pt-3 border-t border-white/20">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-white/90 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                የሙከራ አካውንቶች (Quick Demo Logins):
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('0911000000', 'admin123')}
                  className="bg-white/20 hover:bg-white/35 text-white text-[11px] font-medium py-1.5 px-2 rounded-xl text-center transition-all border border-white/20 shadow-xs"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('0922000000', 'clinician123')}
                  className="bg-white/20 hover:bg-white/35 text-white text-[11px] font-medium py-1.5 px-2 rounded-xl text-center transition-all border border-white/20 shadow-xs"
                >
                  🩺 Clinician
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('0933000000', 'patient123')}
                  className="bg-white/20 hover:bg-white/35 text-white text-[11px] font-medium py-1.5 px-2 rounded-xl text-center transition-all border border-white/20 shadow-xs"
                >
                  🤰 Patient
                </button>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {/* Mode Switcher */}
            <div className="flex bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  mode === 'login' ? 'bg-white text-primary shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                መግቢያ (Log In)
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  mode === 'register' ? 'bg-white text-primary shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                አዲስ ምዝገባ (Register)
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <>
                  {/* Role Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">የአካውንት አይነት (Account Role)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('patient')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          role === 'patient'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <UserIcon className="w-4 h-4" />
                        ታካሚ (Patient)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('clinician')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          role === 'clinician'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Stethoscope className="w-4 h-4" />
                        የጤና ባለሙያ (Clinician)
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">ሙሉ ስም (Full Name)</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ለምሳሌ፡ አስቴር በቀለ"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>

                  {role === 'patient' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">እድሜ (Age)</label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="26"
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">መለያ ቁጥር (ID Number)</label>
                        <input
                          type="text"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          placeholder="አማራጭ (Optional)"
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">የሙያ ዘርፍ (Specialty / Title)</label>
                        <input
                          type="text"
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          placeholder="ለምሳሌ፡ አዋላጅ ነርስ / ሀኪም"
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">የጤና ተቋም (Health Facility)</label>
                        <input
                          type="text"
                          value={facilityName}
                          onChange={(e) => setFacilityName(e.target.value)}
                          placeholder="ለምሳሌ፡ ጥቁር አንበሳ ሆስፒታል"
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ስልክ ቁጥር (Phone Number) <span className="text-primary">*መለያ</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0911000000"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  የይለፍ ቃል (Password) <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {loading ? (
                  <span>በመጠበቅ ላይ...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{mode === 'login' ? 'ግባ (Log In)' : 'ይመዝገቡ (Create Account)'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
