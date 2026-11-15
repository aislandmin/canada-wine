import { addDays } from '../shared/discount';
import { todayLocal } from './format';

/**
 * Quick date-range buttons shared by 概览 and 交易记录, so 本月 / 上月 / 本季度 … mean
 * exactly the same dates on both pages. 'all' (no date limit) is only offered where it
 * makes sense (交易记录).
 */
export type RangePreset = 'all' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'lastYear' | 'custom';

export const PERIOD_PRESETS: { key: Exclude<RangePreset, 'all'>; label: string }[] = [
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'quarter', label: '本季度' },
  { key: 'year', label: '本年' },
  { key: 'lastYear', label: '去年' },
  { key: 'custom', label: '自定义' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date range for a preset, relative to today (visitor's time zone). */
export function presetRange(p: Exclude<RangePreset, 'all' | 'custom'>): { from: string; to: string } {
  const today = todayLocal();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (p) {
    case 'month':
      return { from: `${y}-${pad(m)}-01`, to: today };
    case 'lastMonth': {
      const lastPrev = addDays(`${y}-${pad(m)}-01`, -1);
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
    case 'quarter':
      return { from: `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`, to: today };
    case 'year':
      return { from: `${y}-01-01`, to: today };
    case 'lastYear':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
}
