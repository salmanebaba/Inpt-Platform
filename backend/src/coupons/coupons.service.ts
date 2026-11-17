import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponStatus, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { Identity } from '../auth/security';
import { Database } from '../common/database';
import { CouponQuery, pageResult, paging } from '../common/http';
import { codeHash, generateCode } from './code';

// Explicit selection keeps codeHash and redemption identities out of inventory responses.
export const couponSelect = {
  id: true,
  publicSerial: true,
  batchId: true,
  status: true,
  assignedSellerId: true,
  activatedAt: true,
  redeemedAt: true,
  createdAt: true,
  batch: { select: { label: true, amountCents: true } },
} as const;
export const unavailableCode = 'Coupon invalide ou indisponible.';
@Injectable()
export class CouponsService {
  constructor(private readonly db: Database) {}
  async createBatch(
    admin: Identity,
    body: { label: string; amountCents: number; quantity: number; assignedSellerId?: string },
  ) {
    if (body.assignedSellerId) {
      const seller = await this.db.user.findUnique({ where: { id: body.assignedSellerId } });
      if (seller?.role !== Role.SELLER || !seller.isActive)
        throw new BadRequestException('Vendeur indisponible.');
    }
    return this.db.atomic(async (tx) => {
      const batch = await tx.couponBatch.create({
        data: {
          label: body.label,
          amountCents: body.amountCents,
          quantity: body.quantity,
          createdById: admin.id,
        },
      });
      const printable = Array.from({ length: body.quantity }, () => ({
        publicSerial: `SR-${randomBytes(8).toString('hex').toUpperCase()}`,
        code: generateCode(),
        amountCents: body.amountCents,
      }));
      await tx.coupon.createMany({
        data: printable.map((c) => ({
          batchId: batch.id,
          publicSerial: c.publicSerial,
          codeHash: codeHash(c.code),
          assignedSellerId: body.assignedSellerId,
        })),
      });
      return {
        isDemo: true,
        batch,
        printable,
        warning: 'Codes affichés une seule fois. Exportez et conservez les coupons en lieu sûr.',
      };
    });
  }
  async list(query: CouponQuery, sellerId?: string) {
    const where = {
      status: query.status,
      assignedSellerId: sellerId,
      ...(query.search
        ? { publicSerial: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.coupon.findMany({
        where,
        select: couponSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paging(query),
      }),
      this.db.coupon.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async activate(actor: Identity, reference: string, saleReference?: string) {
    return this.db.atomic(async (tx) => {
      const coupon = await tx.coupon.findFirst({
        where: {
          OR: [
            { publicSerial: reference },
            ...(/^[0-9a-f-]{36}$/i.test(reference) ? [{ id: reference }] : []),
          ],
        },
        include: { batch: true },
      });
      if (!coupon) throw new NotFoundException('Coupon introuvable.');
      if (actor.role === Role.SELLER && coupon.assignedSellerId !== actor.id)
        throw new ForbiddenException('Ce coupon ne vous est pas attribué.');
      const changed = await tx.coupon.updateMany({
        where: { id: coupon.id, status: CouponStatus.CREATED },
        data: { status: CouponStatus.ACTIVE, activatedById: actor.id, activatedAt: new Date() },
      });
      if (changed.count !== 1)
        throw new ConflictException('Ce coupon a déjà été activé ou annulé.');
      const sale = await tx.couponSale.create({
        data: {
          couponId: coupon.id,
          sellerId: actor.id,
          amountCents: coupon.batch.amountCents,
          saleReference,
        },
      });
      return {
        isDemo: true,
        coupon: await tx.coupon.findUnique({ where: { id: coupon.id }, select: couponSelect }),
        sale,
      };
    });
  }
  async redeem(student: Identity, rawCode: string) {
    const hash = codeHash(rawCode);
    return this.db.atomic(async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { codeHash: hash },
        include: { batch: true },
      });
      if (!coupon) throw new ConflictException(unavailableCode);
      const changed = await tx.coupon.updateMany({
        where: { id: coupon.id, status: CouponStatus.ACTIVE },
        data: { status: CouponStatus.REDEEMED, redeemedById: student.id, redeemedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException(unavailableCode);
      const wallet = await tx.wallet.update({
        where: { userId: student.id },
        data: { balanceCents: { increment: coupon.batch.amountCents } },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'COUPON_RECHARGE',
          amountCents: coupon.batch.amountCents,
          balanceAfterCents: wallet.balanceCents,
          couponId: coupon.id,
        },
      });
      return {
        success: true,
        isDemo: true,
        creditedCents: coupon.batch.amountCents,
        balanceCents: wallet.balanceCents,
        transactionId: transaction.id,
      };
    });
  }
  async void(reference: string) {
    return this.db.atomic(async (tx) => {
      // An activated coupon represents an issued sale; preserve it for reconciliation.
      const changed = await tx.coupon.updateMany({
        where: {
          OR: [
            { publicSerial: reference },
            ...(/^[0-9a-f-]{36}$/i.test(reference) ? [{ id: reference }] : []),
          ],
          status: 'CREATED',
        },
        data: { status: 'VOID' },
      });
      if (changed.count !== 1)
        throw new ConflictException('Seuls les coupons non vendus peuvent être annulés.');
      return { isDemo: true, success: true };
    });
  }
}
