import { describe, expect, it } from 'vitest';
import { addDays, applyDiscount, deservedDiscount, itemsSubtotal, tierFor, windowStart } from './discount';

describe('order maths', () => {
  it('sums line items to the cent', () => {
    expect(itemsSubtotal([{ qty: 3, unitPrice: 0.1 }, { qty: 24, unitPrice: 56 }])).toBe(1344.3);
  });
  it('applies a discount and rounds to cents', () => {
    expect(applyDiscount(8550, 0.1)).toBe(7695);
    expect(applyDiscount(99.99, 0.15)).toBe(84.99);
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});
import type { TierTable } from './types';

// The 2027 discount tiers.
const TIERS: TierTable = {
  CAD: [
    { min: 2000, rate: 0.05 },
    { min: 4000, rate: 0.1 },
    { min: 8000, rate: 0.15 },
    { min: 15000, rate: 0.2 },
  ],
  CNY: [
    { min: 10000, rate: 0.05 },
    { min: 20000, rate: 0.1 },
    { min: 40000, rate: 0.15 },
    { min: 75000, rate: 0.2 },
  ],
};

describe('tierFor', () => {
  it('returns 0% below the first tier', () => {
    const r = tierFor(1999.99, TIERS.CAD);
    expect(r.rate).toBe(0);
    expect(r.next?.min).toBe(2000);
    expect(r.toNext).toBe(0.01);
  });

  it.each([
    [2000, 0.05],
    [3999, 0.05],
    [4000, 0.1],
    [7999.5, 0.1],
    [8000, 0.15],
    [14999, 0.15],
    [15000, 0.2],
    [1_000_000, 0.2],
  ])('CAD %d -> %d', (total, rate) => {
    expect(tierFor(total, TIERS.CAD).rate).toBe(rate);
  });

  it('has no next tier at the top', () => {
    const r = tierFor(80000, TIERS.CNY);
    expect(r.next).toBeNull();
    expect(r.toNext).toBe(0);
  });

  it('accepts unsorted tiers', () => {
    const shuffled = [...TIERS.CNY].reverse();
    expect(tierFor(25000, shuffled).rate).toBe(0.1);
  });
});

describe('deservedDiscount', () => {
  it('uses the better of the two currencies', () => {
    const d = deservedDiscount({ CAD: 4500, CNY: 12000 }, TIERS);
    expect(d.byCurrency.CAD.rate).toBe(0.1);
    expect(d.byCurrency.CNY.rate).toBe(0.05);
    expect(d.rate).toBe(0.1);
  });

  it('is 0 with no purchases', () => {
    expect(deservedDiscount({ CAD: 0, CNY: 0 }, TIERS).rate).toBe(0);
  });
});

describe('windowStart', () => {
  it('goes back N years', () => {
    expect(windowStart('2027-03-15', 2)).toBe('2025-03-15');
  });
  it('clamps Feb 29 to Feb 28', () => {
    expect(windowStart('2028-02-29', 2)).toBe('2026-02-28');
  });
  it('rejects bad input', () => {
    expect(() => windowStart('2027/03/15', 2)).toThrow();
  });
});
