import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { hash } from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { Database } from '../src/common/database';
import { configureHttp } from '../src/common/http';
import { codeHash, generateCode } from '../src/coupons/code';

describe('SmartResto transactional workflows (real PostgreSQL)', () => {
  let app: INestApplication;
  let db: Database;
  const users: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const password = 'TestResto2026!';
  const get = (path: string, role = 'student') =>
    request(app.getHttpServer()).get(`/api/v1${path}`).auth(tokens[role], { type: 'bearer' });
  const post = (path: string, body: object, role = 'student') =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .auth(tokens[role], { type: 'bearer' })
      .send(body);
  async function wallet(user = 'student') {
    return db.wallet.findUniqueOrThrow({ where: { userId: users[user] } });
  }
  async function batch(quantity = 1, seller = 'seller', amountCents = 5000) {
    const response = await post(
      '/admin/coupon-batches',
      { label: 'Integration batch', amountCents, quantity, assignedSellerId: users[seller] },
      'admin',
    ).expect(201);
    return response.body as {
      batch: { id: string };
      printable: { code: string; publicSerial: string; amountCents: number }[];
    };
  }
  async function active() {
    const created = await batch();
    const coupon = created.printable[0];
    await post(
      `/seller/coupons/${coupon.publicSerial}/activate`,
      { simulatedCashConfirmed: true },
      'seller',
    ).expect(201);
    return coupon;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
    db = app.get(Database);
    // setup.ts requires a dedicated *_test database before any app/database import.
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE "WalletTransaction", "CouponSale", "Meal", "Coupon", "CouponBatch", "Wallet", "User" CASCADE',
    );
    const passwordHash = await hash(password, 12);
    for (const [key, role] of Object.entries({
      student: Role.STUDENT,
      student2: Role.STUDENT,
      seller: Role.SELLER,
      seller2: Role.SELLER,
      admin: Role.ADMIN,
    })) {
      const user = await db.user.create({
        data: {
          email: `${key}@test.local`,
          fullName: `Test ${key}`,
          role,
          passwordHash,
          ...(role === Role.STUDENT ? { wallet: { create: {} } } : {}),
        },
      });
      users[key] = user.id;
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password })
        .expect(201);
      tokens[key] = response.body.accessToken;
    }
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('authenticates students, rejects wrong credentials and enforces RBAC', async () => {
    expect(tokens.student).toBeTruthy();
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@test.local', password: 'incorrect' })
      .expect(401);
    await get('/admin/coupons').expect(403);
    await get('/seller/coupons').expect(403);
    await request(app.getHttpServer()).get('/api/v1/wallet/me').expect(401);
    await get('/wallet/me', 'seller').expect(403);
  });
  it('returns secrets only once, persists HMACs and exposes safe inventory', async () => {
    const created = await batch(2);
    const stored = await db.coupon.findMany({ where: { batchId: created.batch.id } });
    expect(stored).toHaveLength(2);
    for (const code of created.printable) {
      expect(code.code).toMatch(/^RESTO-(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
      expect(stored.find((c) => c.publicSerial === code.publicSerial)?.codeHash).toBe(
        codeHash(code.code),
      );
      expect(JSON.stringify(stored)).not.toContain(code.code);
    }
    for (const [path, role] of [
      ['/admin/coupons', 'admin'],
      ['/admin/coupon-batches', 'admin'],
      ['/seller/coupons', 'seller'],
    ]) {
      const response = await get(path, role).expect(200);
      expect(JSON.stringify(response.body)).not.toContain('codeHash');
      expect(JSON.stringify(response.body)).not.toContain(created.printable[0].code);
    }
  });
  it('rejects CREATED redemption then atomically activates a simulated sale', async () => {
    const code = (await batch()).printable[0];
    const before = await wallet();
    await post('/coupons/redeem', { code: code.code }).expect(409);
    expect((await wallet()).balanceCents).toBe(before.balanceCents);
    await post(`/seller/coupons/${code.publicSerial}/activate`, {}, 'seller').expect(400);
    await post(
      `/seller/coupons/${code.publicSerial}/activate`,
      { simulatedCashConfirmed: true, saleReference: 'SIM-001' },
      'seller',
    ).expect(201);
    const coupon = await db.coupon.findUniqueOrThrow({
      where: { publicSerial: code.publicSerial },
      include: { sale: true },
    });
    expect(coupon.status).toBe('ACTIVE');
    expect(coupon.sale?.sellerId).toBe(users.seller);
    expect(coupon.sale?.amountCents).toBe(5000);
    await post(
      `/seller/coupons/${code.publicSerial}/activate`,
      { simulatedCashConfirmed: true },
      'seller',
    ).expect(409);
    expect(await db.couponSale.count({ where: { couponId: coupon.id } })).toBe(1);
  });
  it('credits exactly 5000 cents and writes one ledger entry, with code normalization', async () => {
    const coupon = await active();
    const before = await wallet();
    const response = await post('/coupons/redeem', {
      code: ` ${coupon.code.toLowerCase().replaceAll('-', ' ')} `,
    }).expect(201);
    expect(response.body).toMatchObject({
      isDemo: true,
      creditedCents: 5000,
      balanceCents: before.balanceCents + 5000,
    });
    const record = await db.walletTransaction.findUniqueOrThrow({
      where: { id: response.body.transactionId },
    });
    expect(record.amountCents).toBe(5000);
    expect(record.balanceAfterCents).toBe(before.balanceCents + 5000);
  });
  it('rejects repeat redemption and redemption into a second wallet', async () => {
    const coupon = await active();
    await post('/coupons/redeem', { code: coupon.code }).expect(201);
    const before = await wallet();
    await post('/coupons/redeem', { code: coupon.code }).expect(409);
    await post('/coupons/redeem', { code: coupon.code }, 'student2').expect(409);
    expect((await wallet()).balanceCents).toBe(before.balanceCents);
    expect((await wallet('student2')).balanceCents).toBe(0);
  });
  it('credits exactly once under six parallel redemption requests', async () => {
    const coupon = await active();
    const before = await wallet();
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => post('/coupons/redeem', { code: coupon.code })),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
    expect((await wallet()).balanceCents).toBe(before.balanceCents + 5000);
    const stored = await db.coupon.findUniqueOrThrow({
      where: { publicSerial: coupon.publicSerial },
    });
    expect(await db.walletTransaction.count({ where: { couponId: stored.id } })).toBe(1);
  });
  it('uses the same safe error for invalid and VOID coupons without changing balances', async () => {
    const coupon = (await batch()).printable[0];
    const before = await wallet();
    await post(`/admin/coupons/${coupon.publicSerial}/void`, {}, 'admin').expect(201);
    const invalid = await post('/coupons/redeem', { code: generateCode() }).expect(409);
    const voided = await post('/coupons/redeem', { code: coupon.code }).expect(409);
    expect(invalid.body.message).toBe(voided.body.message);
    expect((await wallet()).balanceCents).toBe(before.balanceCents);
  });
  it('scopes seller inventory, sales and activation by ownership', async () => {
    const coupon = (await batch(1, 'seller2')).printable[0];
    await post(
      `/seller/coupons/${coupon.publicSerial}/activate`,
      { simulatedCashConfirmed: true },
      'seller',
    ).expect(403);
    const response = await get('/seller/coupons', 'seller').expect(200);
    expect(
      response.body.items.every(
        (item: { assignedSellerId: string }) => item.assignedSellerId === users.seller,
      ),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(coupon.publicSerial);
    await post(
      `/seller/coupons/${coupon.publicSerial}/activate`,
      { simulatedCashConfirmed: true },
      'seller2',
    ).expect(201);
    const sales = await get('/seller/sales', 'seller').expect(200);
    expect(JSON.stringify(sales.body)).not.toContain(coupon.publicSerial);
  });
  it('atomically debits a 140-cent meal and updates own history and stats', async () => {
    const before = await wallet();
    const mealCount = await db.meal.count({ where: { userId: users.student } });
    const response = await post(
      '/admin/demo/meals',
      { studentId: users.student, type: 'LUNCH', priceCents: 140 },
      'admin',
    ).expect(201);
    expect(response.body.balanceCents).toBe(before.balanceCents - 140);
    const record = await db.walletTransaction.findUniqueOrThrow({
      where: { id: response.body.transactionId },
    });
    expect(record.amountCents).toBe(-140);
    expect(record.mealId).toBe(response.body.meal.id);
    const stats = await get('/meals/me/stats').expect(200);
    expect(stats.body.totalMeals).toBe(mealCount + 1);
    expect(stats.body.totalSpentCents).toBe(140);
    expect((await get('/meals/me').expect(200)).body.total).toBe(mealCount + 1);
    expect((await get('/meals/me', 'student2').expect(200)).body.total).toBe(0);
  });
  it('rejects insufficient funds without a meal, ledger entry or negative balance', async () => {
    const count = await db.walletTransaction.count();
    await post('/admin/demo/meals', { studentId: users.student2, type: 'DINNER' }, 'admin').expect(
      409,
    );
    expect((await wallet('student2')).balanceCents).toBe(0);
    expect(await db.walletTransaction.count()).toBe(count);
    expect(await db.meal.count({ where: { userId: users.student2 } })).toBe(0);
  });
  it('rejects client-supplied identity, amounts, invalid pagination and denominations', async () => {
    await post('/coupons/redeem', {
      code: generateCode(),
      amountCents: 99999,
      userId: users.student2,
    }).expect(400);
    await get('/wallet/me/transactions?limit=1000').expect(400);
    await post(
      '/admin/coupon-batches',
      { label: 'Bad', quantity: 101, amountCents: 5000 },
      'admin',
    ).expect(400);
    await post(
      '/admin/coupon-batches',
      { label: 'Bad', quantity: 1, amountCents: 123 },
      'admin',
    ).expect(400);
    await post(
      '/admin/demo/meals',
      { studentId: users.student, type: 'LUNCH', priceCents: 1.4 },
      'admin',
    ).expect(400);
  });
  it('enforces immutable audit records and wallet-ledger consistency in PostgreSQL', async () => {
    const record = await db.walletTransaction.findFirstOrThrow();
    await expect(
      db.walletTransaction.update({ where: { id: record.id }, data: { amountCents: 1 } }),
    ).rejects.toThrow();
    await expect(db.walletTransaction.delete({ where: { id: record.id } })).rejects.toThrow();
    const before = await wallet();
    await expect(
      db.wallet.update({ where: { id: before.id }, data: { balanceCents: { increment: 1 } } }),
    ).rejects.toThrow();
    expect((await wallet()).balanceCents).toBe(before.balanceCents);
    const total = await db.walletTransaction.aggregate({
      where: { walletId: before.id },
      _sum: { amountCents: true },
    });
    expect(total._sum.amountCents).toBe(before.balanceCents);
  });
  it('enforces the actual login rate limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 16; i++)
      statuses.push(
        (
          await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email: 'nobody@test.local', password: 'incorrect' })
        ).status,
      );
    expect(statuses).toContain(429);
  });
});
