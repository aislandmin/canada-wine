import type { CountryCode } from './types';

/**
 * Normalize a mobile number to "+<country><digits>", or return null if invalid.
 * Supports mainland China (+86, 11-digit mobiles) and Canada/US (+1, 10 digits).
 */
export function normalizePhone(cc: CountryCode, raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith(cc)) digits = digits.slice(cc.length);
  else if (digits.startsWith(cc.slice(1)) && digits.length > (cc === '+86' ? 11 : 10)) digits = digits.slice(cc.length - 1);
  if (!/^\d+$/.test(digits)) return null;

  if (cc === '+86') return /^1[3-9]\d{9}$/.test(digits) ? `+86${digits}` : null;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
}

/** "+8613812345678" -> "+86 138 1234 5678", "+14165551234" -> "+1 (416) 555-1234" */
export function formatPhone(phone: string): string {
  if (phone.startsWith('+86')) {
    const d = phone.slice(3);
    return `+86 ${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  }
  if (phone.startsWith('+1')) {
    const d = phone.slice(2);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return phone;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
