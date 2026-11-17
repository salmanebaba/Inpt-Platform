import { Injectable } from '@nestjs/common';
import { Database } from '../common/database';
export interface RechargeRequest {
  studentExternalId: string;
  amountCents: number;
  externalReference: string;
}
export interface RestaurantIntegrationPort {
  getRestaurantBalance(
    studentExternalId: string,
  ): Promise<{ balanceCents: number; isDemo: boolean }>;
  requestRecharge(
    request: RechargeRequest,
  ): Promise<{ externalReference: string; transactionId: string; isDemo: boolean }>;
}
/** Demo-only boundary. No network client, school database credentials or live adapter. */
@Injectable()
export class DemoRestaurantAdapter implements RestaurantIntegrationPort {
  constructor(private readonly db: Database) {}
  async getRestaurantBalance(studentExternalId: string) {
    const wallet = await this.db.wallet.findUniqueOrThrow({ where: { userId: studentExternalId } });
    return { balanceCents: wallet.balanceCents, isDemo: true };
  }
  async requestRecharge(request: RechargeRequest) {
    // The coupon workflow owns crediting. Stable coupon IDs reconcile an existing
    // credit here, rather than creating a second balance change through this port.
    const entry = await this.db.walletTransaction.findFirst({
      where: {
        couponId: request.externalReference,
        wallet: { userId: request.studentExternalId },
        amountCents: request.amountCents,
        type: 'COUPON_RECHARGE',
      },
    });
    if (!entry) throw new Error('Demo credit must be recorded through coupon redemption first.');
    return { externalReference: request.externalReference, transactionId: entry.id, isDemo: true };
  }
}
