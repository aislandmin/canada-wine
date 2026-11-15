import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('accepts Chinese mobiles in common formats', () => {
    expect(normalizePhone('+86', '13812345678')).toBe('+8613812345678');
    expect(normalizePhone('+86', '138 1234 5678')).toBe('+8613812345678');
    expect(normalizePhone('+86', '+86 138-1234-5678')).toBe('+8613812345678');
    expect(normalizePhone('+86', '8613812345678')).toBe('+8613812345678');
  });

  it('rejects invalid Chinese numbers', () => {
    expect(normalizePhone('+86', '12812345678')).toBeNull(); // 2nd digit must be 3-9
    expect(normalizePhone('+86', '1381234567')).toBeNull(); // too short
    expect(normalizePhone('+86', 'abc')).toBeNull();
  });

  it('accepts Canadian numbers', () => {
    expect(normalizePhone('+1', '416-555-1234')).toBe('+14165551234');
    expect(normalizePhone('+1', '(647) 555 1234')).toBe('+16475551234');
    expect(normalizePhone('+1', '1 416 555 1234')).toBe('+14165551234');
    expect(normalizePhone('+1', '+1 416 555 1234')).toBe('+14165551234');
  });

  it('rejects invalid Canadian numbers', () => {
    expect(normalizePhone('+1', '116-555-1234')).toBeNull(); // area code can't start with 1
    expect(normalizePhone('+1', '416-555-123')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats both countries', () => {
    expect(formatPhone('+8613812345678')).toBe('+86 138 1234 5678');
    expect(formatPhone('+14165551234')).toBe('+1 (416) 555-1234');
  });
});
