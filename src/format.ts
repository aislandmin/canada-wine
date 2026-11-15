import type { Currency } from '../shared/types';

const SYMBOL: Record<Currency, string> = { CAD: '$', CNY: '¥' };
export const CURRENCY_LABEL: Record<Currency, string> = { CAD: '加币', CNY: '人民币' };

/** Today's date in the visitor's time zone, as YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-09-15" -> "2026年9月15日" */
export function dateZh(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** $1,234 or $1,234.50 / ¥1,480 */
export function money(amount: number, currency: Currency): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const n = amount.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${SYMBOL[currency]}${n}`;
}
