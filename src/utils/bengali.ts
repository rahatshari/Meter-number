import { Customer } from '../types';

export function toBengaliNum(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
}

export function toEnglishNum(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const bnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(str).replace(/[০-৯]/g, (d) => bnMap[d]);
}

export function normalizePhone(num: string | number | null | undefined): string {
  if (!num) return '';
  let digits = toEnglishNum(String(num)).replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.substring(2);
  if (!digits.startsWith('0') && digits.length === 10) digits = '0' + digits;
  return digits;
}

export function normalizeSms(s: string | number | null | undefined): string {
  if (!s) return '';
  return toEnglishNum(String(s)).replace(/[\s\-_]/g, '').toLowerCase();
}

export function getCurrentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

export function isCustomerPaidThisMonth(c: Customer): boolean {
  return !!c && c.lastPaidMonth === getCurrentMonthStr();
}

export interface CountdownResult {
  type: 'paid' | 'over' | 'warning' | 'safe';
  dueDayBn: string;
  message: string;
  daysBn?: string;
  hoursBn?: string;
}

export function getCountdownStatus(dueDayString: string | undefined, isPaid: boolean): CountdownResult | null {
  if (!dueDayString) return null;
  const dueDayNum = parseInt(toEnglishNum(String(dueDayString)).trim(), 10);
  if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) return null;

  const dueDayBn = toBengaliNum(dueDayNum);

  if (isPaid) {
    return {
      type: 'paid',
      dueDayBn,
      message: `${dueDayBn} তারিখ · এই মাসের বিল পরিশোধিত`,
    };
  }

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), dueDayNum, 23, 59, 59);
  const diff = target.getTime() - now.getTime();

  if (diff < 0) {
    return {
      type: 'over',
      dueDayBn,
      message: `${dueDayBn} তারিখ · এই মাসের সময় শেষ! দ্রুত পরিশোধ করুন`,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const daysBn = toBengaliNum(days);
  const hoursBn = toBengaliNum(hours);

  if (days === 0) {
    return {
      type: 'warning',
      dueDayBn,
      daysBn,
      hoursBn,
      message: `${dueDayBn} তারিখ · আর মাত্র ${hoursBn} ঘণ্টা বাকি!`,
    };
  }

  return {
    type: 'safe',
    dueDayBn,
    daysBn,
    hoursBn,
    message: `${dueDayBn} তারিখ · আর ${daysBn} দিন ${hoursBn} ঘণ্টা বাকি`,
  };
}
