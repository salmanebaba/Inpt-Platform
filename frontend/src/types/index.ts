export type Role = 'STUDENT' | 'SELLER' | 'ADMIN';
export type CouponStatus = 'CREATED' | 'ACTIVE' | 'REDEEMED' | 'VOID';
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export interface User {
  id: string;
  email: string;
  fullName: string;
  studentNumber: string | null;
  role: Role;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
export interface Wallet {
  isDemo: true;
  balanceCents: number;
}
export interface Meal {
  id: string;
  type: MealType;
  priceCents: number;
  consumedAt: string;
}
export interface Transaction {
  id: string;
  type: 'COUPON_RECHARGE' | 'MEAL_DEBIT' | 'ADMIN_ADJUSTMENT';
  amountCents: number;
  balanceAfterCents: number;
  createdAt: string;
  meal?: Meal;
  coupon?: { publicSerial: string };
  wallet?: { user: { fullName: string } };
}
export interface Stats {
  counts: Record<MealType, number>;
  totalMeals: number;
  totalSpentCents: number;
}
export interface Coupon {
  id: string;
  publicSerial: string;
  status: CouponStatus;
  assignedSellerId: string | null;
  batch: { label: string; amountCents: number };
}
export interface Sale {
  id: string;
  amountCents: number;
  soldAt: string;
  saleReference?: string;
  coupon: { publicSerial: string; status: CouponStatus };
  seller: { fullName: string };
}
export interface Batch {
  id: string;
  label: string;
  amountCents: number;
  quantity: number;
  createdAt: string;
}
export interface Printable {
  publicSerial: string;
  code: string;
  amountCents: number;
}
export interface Summary {
  batches: number;
  counts: Partial<Record<CouponStatus, number>>;
  salesCents: number;
  salesCount: number;
  students: number;
}
