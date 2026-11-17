import type { MealType, CouponStatus, Printable } from '../types';
export const money = (cents: number) =>
  `${new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} DH`;
export const date = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
export const time = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
export const mealNames: Record<MealType, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
};
export const statusNames: Record<CouponStatus, string> = {
  CREATED: 'À activer',
  ACTIVE: 'Actif',
  REDEEMED: 'Utilisé',
  VOID: 'Annulé',
};
export const month = () =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
export function printableCsv(rows: Printable[]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [
      ['publicSerial', 'secretCode', 'amountCents', 'currency', 'context'],
      ...rows.map((r) => [r.publicSerial, r.code, r.amountCents, 'MAD', 'DEMONSTRATION']),
    ]
      .map((r) => r.map(escape).join(','))
      .join('\r\n')
  );
}
export function downloadCsv(rows: Printable[]) {
  const url = URL.createObjectURL(
    new Blob([printableCsv(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'smartresto-coupons-secrets.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
