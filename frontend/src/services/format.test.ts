import { describe, expect, it } from 'vitest';
import { date, money, printableCsv, time } from './format';
describe('French display and one-time printable voucher export', () => {
  it('formats integer centimes in MAD without losing cents', () => {
    expect(money(8740)).toBe('87,40 DH');
    expect(money(140)).toBe('1,40 DH');
  });
  it('uses Casablanca even when the browser/server timezone is different', () => {
    expect(time('2026-10-29T12:00:00Z')).toBe('13:00');
    expect(date('2026-10-28T23:30:00Z')).toContain('29');
  });
  it('exports public serial, secret and integer face value with a demo label', () => {
    const result = printableCsv([
      { publicSerial: 'SR-1234', code: 'RESTO-SECRET', amountCents: 5000 },
    ]);
    expect(result).toContain('"publicSerial","secretCode","amountCents","currency","context"');
    expect(result).toContain('"SR-1234","RESTO-SECRET","5000","MAD","DEMONSTRATION"');
  });
});
