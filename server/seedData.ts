// Initial catalog. Only used to populate an empty database; after that, products are managed
// in the admin pages.

import type { SpecItem } from '../shared/types';

export interface SeedProduct {
  catalogNo: string;
  category: string;
  nameZh: string;
  nameEn: string;
  winery: string;
  vintage: string;
  volume: string;
  price: { CAD: number; CNY: number };
  giftBox?: { CAD: number; CNY: number };
  tastingNotes: string;
  styleLabel: string;
  styleDescription: string;
  servingTemp: string;
  pairing: string;
  specs: SpecItem[];
  awards: string[];
}

export const SEED_CATEGORIES = ['红葡萄酒', '冰酒', '晚收冰酒'];

const PILLITTERI = 'Pillitteri Estates Winery';
const PELEE = 'Pelee Island Winery';
const MAGNOTTA = 'Magnotta Winery';

const GIFT_BOX = { CAD: 5, CNY: 25 };

const PELEE_NOTES =
  '散发完美的成熟水果的香气，此款酒体饱满的干红入口表现出黑加仑，蓝莓和松木等多种风味，微辣和跳跃的单宁使回味长久而丰富。';

const ICEWINE_AWARDS = [
  'Los Angeles International Wine Competition 2018 · Best of Class 金奖',
  'Decanter World Wine Awards 2018 · 金奖',
  'WineAlign National Wine Awards of Canada 2017 · 金奖',
  'Challenge International du Vin 2018（法国）· 金奖',
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    catalogNo: '01',
    category: '红葡萄酒',
    nameZh: '解百纳美乐干红葡萄酒 5升限量版',
    nameEn: 'Cabernet Merlot Limited Edition 5L',
    winery: PILLITTERI,
    vintage: '2015',
    volume: '5L',
    price: { CAD: 280, CNY: 1480 },
    tastingNotes:
      '这款平衡感极佳的解百纳美乐干红，酒体适中且柔顺。香气中带有黑樱桃的芬芳，伴随一丝微辣。入口风味层次丰富，展现出李子、浆果和香草的迷人特质。果香、单宁与酸度的完美结合赋予其典型的解百纳结构和平衡感，余味悠长。',
    styleLabel: '限量大瓶',
    styleDescription: '酒体适中，柔顺平衡，余味悠长',
    servingTemp: '16 - 18 °C',
    pairing: '猪肉，牛肉，羊肉',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '酒精度', value: '13.5%' },
      { label: '橡木桶成熟', value: '18 个月' },
      { label: '含糖量', value: '2 g/L' },
      { label: '最佳饮用期', value: '现在到 2030' },
      { label: '规格', value: '5L' },
    ],
    awards: [],
  },
  {
    catalogNo: '03',
    category: '红葡萄酒',
    nameZh: '酒艺师品丽珠干红葡萄酒',
    nameEn: 'Wine Artisan Cabernet Franc',
    winery: PELEE,
    vintage: '2020',
    volume: '750ml',
    price: { CAD: 29, CNY: 160 },
    giftBox: GIFT_BOX,
    tastingNotes: PELEE_NOTES,
    styleLabel: '芳香浓郁',
    styleDescription: '芳香型干红，香气浓郁厚重饱满，酒体饱满',
    servingTemp: '16 - 20 °C',
    pairing: '牛排，奶酪，红烧鱼',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '混酿比例', value: '100% 品丽珠' },
      { label: '酒精度', value: '13.5%' },
      { label: '含糖量', value: '4 g/L' },
      { label: '规格', value: '750ml' },
    ],
    awards: [
      'China Wine & Spirits Awards (CWSA) · Trophy Winner',
      'The Royal Wine Competition · Best Red Wine',
      'Finger Lakes International Wine Competition 2016 · 银奖',
    ],
  },
  {
    catalogNo: '06',
    category: '冰酒',
    nameZh: '大鹅威代尔白冰酒',
    nameEn: 'Northern Wing Vidal Icewine',
    winery: PILLITTERI,
    vintage: '2021',
    volume: '375ml',
    price: { CAD: 56, CNY: 280 },
    tastingNotes:
      '大鹅优质威代尔白冰酒，富含沁人心脾的花香，散发浓重的蜂蜜，柑橘，桃子和杏子等果香。入口酒体饱满，菠萝，荔枝和蜂蜜是其标志性风味，香甜厚重，酸甜平衡，回味长久。',
    styleLabel: '优质白冰葡萄酒',
    styleDescription: '天然芬芳，厚重饱满',
    servingTemp: '6 - 8 °C',
    pairing: '水果蛋糕，西餐甜点',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '葡萄品种', value: '100% 威代尔' },
      { label: '采摘温度', value: '-8 °C' },
      { label: '酒精度', value: '11%' },
      { label: '含糖量', value: '216 g/L' },
      { label: '规格', value: '375ml' },
    ],
    awards: ICEWINE_AWARDS,
  },
  {
    catalogNo: '14',
    category: '晚收冰酒',
    nameZh: '蝴蝶谷解百纳晚收红冰酒',
    nameEn: 'Vivid Collection Cabernet Late Harvest',
    winery: PILLITTERI,
    vintage: '2019',
    volume: '375ml',
    price: { CAD: 45, CNY: 235 },
    tastingNotes:
      '蝴蝶谷解百纳晚收红冰葡萄酒，呈现红宝石的颜色。散发草莓和樱桃的芳香，入口饱含红色水果的味道，伴随黑巧克力和成熟苹果的风味。',
    styleLabel: '晚收红冰葡萄酒',
    styleDescription: '口味丰富，酸甜平衡',
    servingTemp: '6 - 10 °C',
    pairing: '餐后甜点',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '葡萄品种', value: '100% 品丽珠' },
      { label: '采摘温度', value: '-8 °C' },
      { label: '酒精度', value: '11%' },
      { label: '含糖量', value: '185 g/L' },
      { label: '规格', value: '375ml' },
    ],
    awards: [
      'San Francisco International Wine Competition 2018 · 双金奖',
      'Finger Lakes International Wine Competition · 金奖',
      'International Wine & Spirits Competition · Critics Challenge 双金奖',
    ],
  },
  {
    catalogNo: '15',
    category: '冰酒',
    nameZh: '蝴蝶谷威代尔白冰酒',
    nameEn: 'Vivid Collection Vidal Icewine',
    winery: PILLITTERI,
    vintage: '2021',
    volume: '375ml',
    price: { CAD: 50, CNY: 260 },
    tastingNotes:
      '蝴蝶谷优质威代尔白冰酒，色泽金黄，扑鼻的蜂蜜芳香沁人心脾，伴随诱人而强烈的杏子芒果和菠萝的水果芬芳。入口酒体醇厚，口味饱满而富于层次感。',
    styleLabel: '优质白冰葡萄酒',
    styleDescription: '天然芬芳，厚重饱满',
    servingTemp: '6 - 8 °C',
    pairing: '水果蛋糕，西餐甜点',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '葡萄品种', value: '100% 威代尔' },
      { label: '采摘温度', value: '-8 °C' },
      { label: '酒精度', value: '11%' },
      { label: '含糖量', value: '210 g/L' },
      { label: '规格', value: '375ml' },
    ],
    awards: ICEWINE_AWARDS,
  },
  {
    catalogNo: '19',
    category: '红葡萄酒',
    nameZh: '加拿大图腾美乐干红葡萄酒',
    nameEn: 'Royal Peak Merlot',
    winery: MAGNOTTA,
    vintage: '2022',
    volume: '750ml',
    price: { CAD: 25, CNY: 130 },
    giftBox: GIFT_BOX,
    tastingNotes:
      '加拿大图腾象征着加拿大早期源自旧世界葡萄酒酿造文化。此款干红酒色宝石红，橡木熟成，中度柔顺的酒体散发令人愉悦的树莓、李子等红色水果芳香，伴随橡木和烟熏的风味。入口平衡感极佳，回味悠长。',
    styleLabel: '波尔多左岸',
    styleDescription: '橡木熟成，酒体中到饱满，柔顺，回味长',
    servingTemp: '16 - 20 °C',
    pairing: '牛羊肉，奶酪',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '葡萄品种', value: '100% 美乐' },
      { label: '酒精度', value: '13%' },
      { label: '含糖量', value: '6 g/L' },
      { label: '橡木熟成', value: '12 个月' },
      { label: '规格', value: '750ml' },
    ],
    awards: [
      'Vinalies Internationales（法国）',
      'Beverage Testing Institute · Tastings.com',
      'International Wine Challenge',
      'WineAlign National Wine Awards of Canada 2017',
    ],
  },
  {
    catalogNo: '20',
    category: '红葡萄酒',
    nameZh: '富贵谷特级珍藏版赤霞珠红葡萄酒',
    nameEn: 'Rich Valley Grand Reserve Cabernet Sauvignon',
    winery: MAGNOTTA,
    vintage: '2020',
    volume: '750ml',
    price: { CAD: 35, CNY: 190 },
    giftBox: GIFT_BOX,
    tastingNotes:
      '十分杰出的经典波尔多梅多克风格干红葡萄酒，深宝石红色，两年法国橡木桶陈年。散发强烈的黑加仑，覆盆子和雪松等香气，兼具李子，桑葚，橡木和香料的风味。浓郁，醇厚，酒体饱满，而柔滑的口感，回味萦绕深长。适合极为挑剔的红酒爱好者，印象深刻难忘。',
    styleLabel: '波尔多梅多克',
    styleDescription: '橡木熟成 2 年，酒体饱满，回味深长，高端干红',
    servingTemp: '18 - 20 °C，醒酒 30 分钟',
    pairing: '牛扒羊排',
    specs: [
      { label: '年份', value: '2020' },
      { label: '级别', value: '珍藏版' },
      { label: '葡萄品种', value: '100% 赤霞珠' },
      { label: '酒精度', value: '14%' },
      { label: '含糖量', value: '5 g/L' },
      { label: '橡木熟成', value: '18 个月' },
      { label: '规格', value: '750ml' },
    ],
    awards: [
      'International Wine Challenge',
      'WineAlign National Wine Awards of Canada 2017',
      'Ontario Wine Awards',
      'Decanter World Wine Awards 2014',
    ],
  },
  {
    catalogNo: '24',
    category: '晚收冰酒',
    nameZh: '酒艺师威代尔晚收白冰酒',
    nameEn: 'Wine Artisan Late Harvest Vidal',
    winery: PILLITTERI,
    vintage: '2021',
    volume: '500ml',
    price: { CAD: 45, CNY: 235 },
    tastingNotes:
      '酒艺师威代尔晚收冰葡萄酒，酿造于来自加拿大尼亚加拉瀑布优质产区冬天葡萄藤上采摘的霜冻的冰葡萄。清澈跳动的金色，散发强烈的蜂蜜，甜桃和梨子的芳香，入口酒体饱满，风味浓郁甜美，回味酸甜极度平衡。',
    styleLabel: '甜白葡萄酒',
    styleDescription: '甘甜芳香，清新丰满',
    servingTemp: '6 - 8 °C',
    pairing: '餐前开胃，餐后甜点',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '混酿比例', value: '100% 威代尔' },
      { label: '酒精度', value: '11%' },
      { label: '规格', value: '500ml' },
    ],
    awards: [
      'China Wine & Spirits Awards (CWSA)',
      'Challenge International du Vin 2016（法国）· 银奖',
    ],
  },
  {
    catalogNo: '25',
    category: '红葡萄酒',
    nameZh: '葡萄园丁加百纳美乐干红葡萄酒',
    nameEn: 'Vinedressers Cabernet Merlot',
    winery: PELEE,
    vintage: '2019',
    volume: '750ml',
    price: { CAD: 29, CNY: 160 },
    giftBox: GIFT_BOX,
    tastingNotes: PELEE_NOTES,
    styleLabel: '芳香浓郁',
    styleDescription: '芳香型干红，香气浓郁厚重饱满，酒体饱满',
    servingTemp: '16 - 20 °C',
    pairing: '牛排，奶酪，红烧鱼',
    specs: [
      { label: '级别', value: 'VQA' },
      { label: '混酿比例', value: '50% 品丽珠，50% 美乐' },
      { label: '酒精度', value: '13%' },
      { label: '含糖量', value: '4 g/L' },
      { label: '规格', value: '750ml' },
    ],
    awards: [
      'The Royal Wine Competition · Best Red Wine',
      'Finger Lakes International Wine Competition 2016 · 银奖',
      'China Wine & Spirits Awards (CWSA) · Trophy Winner',
    ],
  },
];
