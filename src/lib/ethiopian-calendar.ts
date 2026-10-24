import * as EthiopianDate from 'ethiopian-date';

export interface ECDate {
  year: number;
  month: number;
  day: number;
}

export const MONTH_NAMES_AM = [
  'መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

export function toEC(date: Date): ECDate {
  const converter: any = (EthiopianDate as any).toEthiopian ? EthiopianDate : (EthiopianDate as any).default;
  const [year, month, day] = converter.toEthiopian(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { year, month, day };
}

export function fromEC(year: number, month: number, day: number): Date {
  const converter: any = (EthiopianDate as any).toGregorian ? EthiopianDate : (EthiopianDate as any).default;
  const [gYear, gMonth, gDay] = converter.toGregorian(year, month, day);
  return new Date(gYear, gMonth - 1, gDay);
}

export function formatEC(date: Date): string {
  const ec = toEC(date);
  return `${MONTH_NAMES_AM[ec.month - 1]} ${ec.day}, ${ec.year}`;
}

export function isEthiopianHoliday(date: Date): { isHoliday: boolean; name?: string } {
  const ec = toEC(date);
  
  // Fixed holidays
  if (ec.month === 1 && ec.day === 1) return { isHoliday: true, name: 'አዲስ ዓመት' };
  if (ec.month === 1 && ec.day === 17) return { isHoliday: true, name: 'መስቀል' };
  if (ec.month === 5 && ec.day === 11) return { isHoliday: true, name: 'ጥምቀት' };
  if (ec.month === 7 && ec.day === 25) return { isHoliday: true, name: 'የዓድዋ ድል' };
  if (ec.month === 9 && ec.day === 20) return { isHoliday: true, name: 'ግንቦት 20' };
  
  // Weekend
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return { isHoliday: true, name: 'እሁድ' };
  if (dayOfWeek === 6) return { isHoliday: true, name: 'ቅዳሜ' };

  return { isHoliday: false };
}

export function getNextAvailableAppointment(startDate: Date): Date {
  let date = new Date(startDate);
  while (isEthiopianHoliday(date).isHoliday) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}
