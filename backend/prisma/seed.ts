import '../src/config';
import { PrismaClient, MealType } from '@prisma/client';
import { hash } from 'bcryptjs';
import { codeHash, generateCode } from '../src/coupons/code';
const db = new PrismaClient();
async function seed() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seed is disabled in production.');
  const passwordHash = await hash('DemoResto2026!', 12);
  await db.$transaction(
    async (tx) => {
      // Serialize concurrent startup seeds and preserve existing users and balances.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(843291)`;
      const admin = await tx.user.upsert({
        where: { email: 'admin@smartresto.local' },
        update: {},
        create: {
          email: 'admin@smartresto.local',
          fullName: 'Administration SmartResto',
          role: 'ADMIN',
          passwordHash,
        },
      });
      await tx.user.upsert({
        where: { email: 'seller@smartresto.local' },
        update: {},
        create: {
          email: 'seller@smartresto.local',
          fullName: 'Buvette du campus',
          role: 'SELLER',
          passwordHash,
        },
      });
      const existing = await tx.user.findUnique({ where: { email: 'student@smartresto.local' } });
      if (existing) return;
      const student = await tx.user.create({
        data: {
          email: 'student@smartresto.local',
          fullName: 'Amine Bennani',
          studentNumber: 'ETU-2026-0042',
          role: 'STUDENT',
          passwordHash,
        },
      });
      const wallet = await tx.wallet.create({ data: { userId: student.id } });
      const batch = await tx.couponBatch.create({
        data: {
          label: 'Solde initial de démonstration',
          amountCents: 10000,
          quantity: 1,
          createdById: admin.id,
        },
      });
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(12, 0, 0, 0);
      const coupon = await tx.coupon.create({
        data: {
          publicSerial: 'SR-DEMO-INITIAL',
          batchId: batch.id,
          codeHash: codeHash(generateCode()),
          status: 'REDEEMED',
          activatedById: admin.id,
          activatedAt: start,
          redeemedById: student.id,
          redeemedAt: start,
        },
      });
      await tx.couponSale.create({
        data: {
          couponId: coupon.id,
          sellerId: admin.id,
          saleReference: 'SEED-SIMULATION',
          amountCents: 10000,
          soldAt: start,
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'COUPON_RECHARGE',
          amountCents: 10000,
          balanceAfterCents: 10000,
          couponId: coupon.id,
          createdAt: start,
        },
      });
      const types: MealType[] = [
        'LUNCH',
        'DINNER',
        'BREAKFAST',
        'LUNCH',
        'LUNCH',
        'DINNER',
        'LUNCH',
        'BREAKFAST',
        'LUNCH',
      ];
      for (let i = 0; i < types.length; i++) {
        const consumedAt = new Date(start.getTime() + (i + 1) * 60000);
        const meal = await tx.meal.create({
          data: { userId: student.id, type: types[i], priceCents: 140, consumedAt },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'MEAL_DEBIT',
            amountCents: -140,
            balanceAfterCents: 10000 - 140 * (i + 1),
            mealId: meal.id,
            createdAt: consumedAt,
          },
        });
      }
      await tx.wallet.update({ where: { id: wallet.id }, data: { balanceCents: 8740 } });
    },
    { timeout: 20000 },
  );
  console.log('Demo accounts ready. Credentials and voucher instructions are in README.md.');
}
seed()
  .catch(() => {
    console.error('Demo seed failed; check database configuration.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
