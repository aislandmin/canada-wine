import type { PublicSettings } from '../../shared/types';
import { db } from '../db';

export const DEFAULT_SETTINGS: PublicSettings = {
  siteTitle: '加拿大冰酒 · 葡萄酒',
  siteSubtitle: '来自加拿大安大略省的 VQA 认证冰酒与葡萄酒',
  highlights: ['国内现货 顺丰包邮', '累计消费最高享 20% 折扣', '加拿大 VQA 认证酒款'],
  policyText:
    '感谢您一直以来的信任与支持。近年加拿大酒庄各项运营成本持续上升，酒庄已尽最大努力消化成本压力，尽可能为客户保留折扣优惠。' +
    '自 2027 年起，发往中国的冰酒及葡萄酒将继续免收运费及关税发货，并按以下阶梯标准提供累计销售折扣，最高 20% 优惠。' +
    '折扣以每次订货时往前两年内的累计销售额为计算依据。感谢您的理解，期待与您继续携手合作。',
  contactText: '如需订购或咨询，请联系客服。',
  tiers: {
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
  },
  windowYears: 2,
};

type Key = keyof PublicSettings;

export function getSettings(): PublicSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: PublicSettings = structuredClone(DEFAULT_SETTINGS);
  for (const { key, value } of rows) {
    if (key in out) (out as unknown as Record<string, unknown>)[key] = JSON.parse(value);
  }
  return out;
}

export function setSetting<K extends Key>(key: K, value: PublicSettings[K]): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, JSON.stringify(value));
}
