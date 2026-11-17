import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Identity, Roles } from '../auth/security';
import { Database } from '../common/database';
import { PageQuery, paging, pageResult } from '../common/http';
@ApiTags('Simulated sales and audit')
@ApiBearerAuth()
@Controller()
class SalesController {
  constructor(private readonly db: Database) {}
  private async list(query: PageQuery, sellerId?: string) {
    const where = { sellerId };
    const [items, total] = await this.db.$transaction([
      this.db.couponSale.findMany({
        where,
        include: {
          coupon: { select: { publicSerial: true, status: true } },
          seller: { select: { fullName: true } },
        },
        orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
        ...paging(query),
      }),
      this.db.couponSale.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  @Get('admin/sales') @Roles(Role.ADMIN) admin(@Query() query: PageQuery) {
    return this.list(query);
  }
  @Get('seller/sales') @Roles(Role.SELLER) seller(
    @CurrentUser() user: Identity,
    @Query() query: PageQuery,
  ) {
    return this.list(query, user.id);
  }
  @Get('admin/transactions')
  @Roles(Role.ADMIN)
  async ledger(@Query() query: PageQuery) {
    const [items, total] = await this.db.$transaction([
      this.db.walletTransaction.findMany({
        include: {
          wallet: { select: { user: { select: { fullName: true, studentNumber: true } } } },
          coupon: { select: { publicSerial: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paging(query),
      }),
      this.db.walletTransaction.count(),
    ]);
    return pageResult(items, total, query);
  }
}
@Module({ controllers: [SalesController] })
export class SalesModule {}
