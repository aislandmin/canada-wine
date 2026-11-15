// Types shared by the server (API responses) and the browser.

export type Currency = 'CAD' | 'CNY';
export const CURRENCIES: readonly Currency[] = ['CAD', 'CNY'];

/** Amounts in major units (dollars / yuan). Stored as integer cents in the DB. */
export interface Money {
  CAD: number;
  CNY: number;
}

export interface SpecItem {
  label: string;
  value: string;
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
}

export type ProductStatus = 'active' | 'hidden';

export interface ProductImage {
  id: number;
  url: string;
}

/** Keeps product pages fast to load from China. */
export const MAX_PRODUCT_IMAGES = 10;

export interface Product {
  id: number;
  catalogNo: string;
  nameZh: string;
  nameEn: string;
  winery: string;
  vintage: string;
  volume: string;
  categoryId: number | null;
  categoryName: string | null;
  price: Money;
  /** Extra-charge gift box / bag. null = none offered or no extra charge (not shown). */
  giftBox: Money | null;
  tastingNotes: string;
  styleLabel: string;
  styleDescription: string;
  servingTemp: string;
  pairing: string;
  specs: SpecItem[];
  awards: string[];
  /** The main photo (first of `images`), or null. Used on product cards. */
  imageUrl: string | null;
  /** All photos in display order; the first is the main photo. */
  images: ProductImage[];
  status: ProductStatus;
  updatedAt: string;
}

// ---------- Accounts ----------

export type Role = 'customer' | 'admin';
export type CountryCode = '+86' | '+1';
export const COUNTRY_CODES: readonly CountryCode[] = ['+86', '+1'];

export interface User {
  id: number;
  name: string;
  /** Normalized, e.g. "+8613812345678". */
  phone: string | null;
  email: string | null;
  wechat: string;
  company: string;
  role: Role;
  createdAt: string;
}

export interface TransactionItem {
  /** The catalogue product this line is for (for a gift-box line: the wine it goes with). */
  productId: number | null;
  name: string;
  qty: number;
  unitPrice: number;
  /** True for a 礼盒礼袋 line. Older records may lack it (detected by name instead). */
  giftBox?: boolean;
}

export interface Transaction {
  id: number;
  orderDate: string;
  currency: Currency;
  /** Total actually paid, in major units. This is what counts toward the discount. */
  amount: number;
  subtotal: number | null;
  discountRate: number;
  items: TransactionItem[];
  note: string;
}

export interface AccountSummary {
  asOf: string;
  windowStart: string;
  windowYears: number;
  totals: Money;
  /** Discount earned as of `asOf`: the higher of the two currencies' tiers. */
  discount: {
    rate: number;
    byCurrency: Record<Currency, { total: number; rate: number; next: Tier | null; toNext: number }>;
  };
  /** All of the customer's transactions, newest first. `counted` = inside the window. */
  transactions: (Transaction & { counted: boolean })[];
}

// ---------- Admin ----------

export type UserStatus = 'active' | 'disabled';

export interface AdminUser extends User {
  status: UserStatus;
  adminNote: string;
  lastLoginAt: string | null;
}

export interface AdminUserListItem extends AdminUser {
  /** Spending in the rolling window ending today. */
  totals: Money;
  rate: number;
  txCount: number;
  lastOrderDate: string | null;
}

/** A row in the admin 交易记录 list: a transaction plus who placed it. */
export interface TransactionListItem extends Transaction {
  userId: number;
  userName: string;
  userPhone: string | null;
  userStatus: UserStatus;
}

export interface TransactionListResponse {
  /** Number of transactions matching the filters (all pages). */
  total: number;
  /** Amount paid across all matching transactions, per currency. */
  totals: Money;
  page: number;
  pageSize: number;
  rows: TransactionListItem[];
}

export interface TransactionInput {
  orderDate: string;
  currency: Currency;
  items: TransactionItem[];
  discountRate: number;
  /** Total actually paid. */
  amount: number;
  note: string;
}

/**
 * What a customer had already paid for existing orders in the window ending ON `orderDate`
 * (both ends inclusive), not counting the order itself. Its tier is the order's discount.
 */
export interface DiscountPreview {
  orderDate: string;
  windowStart: string;
  windowEnd: string;
  priorTotals: Money;
}

export interface ProductInput {
  catalogNo: string;
  nameZh: string;
  nameEn: string;
  winery: string;
  vintage: string;
  volume: string;
  categoryId: number | null;
  price: Money;
  giftBox: Money | null;
  tastingNotes: string;
  styleLabel: string;
  styleDescription: string;
  servingTemp: string;
  pairing: string;
  specs: SpecItem[];
  awards: string[];
  status: ProductStatus;
}

export interface SalesSummary {
  /** Total actually paid. */
  sales: number;
  orders: number;
  /** Distinct customers who ordered. */
  buyers: number;
  avgOrder: number;
  /** Σ subtotal × discount rate: what the tier discounts gave away. */
  discountGiven: number;
}

export interface ProductSalesRow {
  key: string;
  kind: 'product' | 'giftBox' | 'other';
  productId: number | null;
  name: string;
  qty: number;
  /** Line totals with each order's discount spread proportionally (so it adds up to what was paid). */
  sales: Money;
}

export interface CustomerSalesRow {
  id: number;
  name: string;
  sales: number;
  orders: number;
}

export interface AdminStats {
  // ---- Snapshot (as of today) ----
  customers: number;
  newCustomersThisMonth: number;
  disabledCustomers: number;
  productsActive: number;
  productsHidden: number;
  /** Customers within reach of their next tier — good people to contact. */
  nearNextTier: { id: number; name: string; currency: Currency; total: number; toNext: number; nextRate: number }[];

  // ---- For the selected date range [from, to] ----
  from: string;
  to: string;
  summary: Record<Currency, SalesSummary>;
  products: ProductSalesRow[];
  topCustomers: Record<Currency, CustomerSalesRow[]>;
  /** Number of orders in range recorded without item lines (not in the product ranking). */
  ordersWithoutItems: number;

  /** The 12 calendar months ending with the month of `to`. */
  monthly: { month: string; sales: Money; orders: Money }[];
}

// ---------- Discount tiers ----------

/** A discount tier: spending >= min (major units) earns `rate` (0.05 = 5%). */
export interface Tier {
  min: number;
  rate: number;
}

export type TierTable = Record<Currency, Tier[]>;

export interface PublicSettings {
  siteTitle: string;
  siteSubtitle: string;
  highlights: string[];
  policyText: string;
  contactText: string;
  tiers: TierTable;
  /** Rolling look-back window for cumulative spending. */
  windowYears: number;
}
