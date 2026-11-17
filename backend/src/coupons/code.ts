import { createHmac, randomBytes } from 'node:crypto';
import { secret } from '../config';
export const DENOMINATIONS = [2000, 5000, 10000];
export function generateCode() {
  return `RESTO-${randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g)!.join('-')}`;
}
export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}
export function codeHash(value: string) {
  return createHmac('sha256', secret('COUPON_HASH_KEY')).update(normalizeCode(value)).digest('hex');
}
