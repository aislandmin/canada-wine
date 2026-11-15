import type { Currency, Money, Tier, TierTable } from './types';
import { CURRENCIES } from './types';

export interface TierResult {
  /** Cumulative amount that was evaluated (major units). */
  total: number;
  /** Discount rate earned (0 when below the first tier). */
  rate: number;
  current: Tier | null;
  next: Tier | null;
  /** How much more must be spent to reach `next` (0 when at the top tier). */
  toNext: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Find the tier a cumulative total falls in. Tiers may be given in any order. */
export function tierFor(total: number, tiers: Tier[]): TierResult {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let current: Tier | null = null;
  for (const t of sorted) if (total >= t.min) current = t;
  const next = sorted.find((t) => t.min > total) ?? null;
  return {
    total,
    rate: current?.rate ?? 0,
    current,
    next,
    toNext: next ? round2(next.min - total) : 0,
  };
}

export interface DeservedDiscount {
  /** The discount the customer is entitled to: the higher of the two currencies' tiers. */
  rate: number;
  byCurrency: Record<Currency, TierResult>;
}

/**
 * Customers may pay in CAD and/or RMB. Each currency's total is checked against
 * its own tier table; the customer earns the better of the two.
 */
export function deservedDiscount(totals: Money, table: TierTable): DeservedDiscount {
  const byCurrency = {} as Record<Currency, TierResult>;
  for (const c of CURRENCIES) byCurrency[c] = tierFor(totals[c], table[c]);
  const rate = Math.max(...CURRENCIES.map((c) => byCurrency[c].rate));
  return { rate, byCurrency };
}

/**
 * Start date (inclusive) of the rolling window that ends at `asOf`.
 * Dates are ISO 'YYYY-MM-DD'. Feb 29 maps to Feb 28 in non-leap years.
 */
export function windowStart(asOf: string, years: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!m) throw new Error(`Invalid date: ${asOf}`);
  const y = Number(m[1]) - years;
  const mo = Number(m[2]);
  let d = Number(m[3]);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > daysInMonth) d = daysInMonth;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Add (or subtract) whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sum of line totals, rounded to cents. */
export function itemsSubtotal(items: { qty: number; unitPrice: number }[]): number {
  return Math.round(items.reduce((s, l) => s + l.qty * l.unitPrice * 100, 0)) / 100;
}

/** Amount payable after a percentage discount, rounded to cents. */
export function applyDiscount(subtotal: number, rate: number): number {
  return Math.round(subtotal * (1 - rate) * 100) / 100;
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
