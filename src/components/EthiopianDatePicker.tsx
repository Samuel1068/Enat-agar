import { useState, useEffect } from 'react';
import { MONTH_NAMES_AM, fromEC, toEC } from '../lib/ethiopian-calendar';

interface EthiopianDatePickerProps {
  value: string; // ISO date string (Gregorian)
  onChange: (value: string) => void;
  label?: string;
}

export function EthiopianDatePicker({ value, onChange, label }: EthiopianDatePickerProps) {
  const initialDate = value ? new Date(value) : new Date();
  const ec = toEC(initialDate);

  const [year, setYear] = useState(ec.year);
  const [month, setMonth] = useState(ec.month);
  const [day, setDay] = useState(ec.day);

  // Sync with external value changes (e.g. form reset)
  useEffect(() => {
    if (value) {
      const newEc = toEC(new Date(value));
      if (newEc.year !== year || newEc.month !== month || newEc.day !== day) {
        setYear(newEc.year);
        setMonth(newEc.month);
        setDay(newEc.day);
      }
    }
  }, [value]);

  const handleDateChange = (y: number, m: number, d: number) => {
    const gDate = fromEC(y, m, d);
    const newIso = gDate.toISOString();
    if (newIso !== value) {
      onChange(newIso);
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => toEC(new Date()).year - 5 + i);
  const days = Array.from({ length: month === 13 ? 6 : 30 }, (_, i) => i + 1);

  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-bold text-text-muted uppercase tracking-wider">{label}</label>}
      <div className="grid grid-cols-3 gap-2">
        <select 
          value={day}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setDay(val);
            handleDateChange(year, month, val);
          }}
          className="p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm appearance-none"
        >
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select 
          value={month}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setMonth(val);
            handleDateChange(year, val, day);
          }}
          className="p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm appearance-none"
        >
          {MONTH_NAMES_AM.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select 
          value={year}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setYear(val);
            handleDateChange(val, month, day);
          }}
          className="p-3 bg-white border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm appearance-none"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}
