import { config } from 'dotenv';
config({ path: ['.env', '../.env'] });
export function secret(name: 'JWT_SECRET' | 'COUPON_HASH_KEY'): string {
  const value = process.env[name];
  if (!value || value.length < 32)
    throw new Error(`${name} must contain at least 32 characters. Run npm run setup.`);
  return value;
}
export function validateConfig() {
  if (secret('JWT_SECRET') === secret('COUPON_HASH_KEY'))
    throw new Error('Use independent JWT and coupon keys.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const price = Number(process.env.MEAL_PRICE_CENTS ?? 140);
  if (!Number.isInteger(price) || price < 1 || price > 10000)
    throw new Error('Invalid MEAL_PRICE_CENTS.');
}
