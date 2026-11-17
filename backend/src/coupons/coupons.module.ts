import { Body, Controller, Get, Header, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  Equals,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser, Identity, Roles } from '../auth/security';
import { CouponQuery, PageQuery, pageResult, paging } from '../common/http';
import { Database } from '../common/database';
import { CouponsService } from './coupons.service';
import { DENOMINATIONS } from './code';
class BatchDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) label!: string;
  @ApiProperty({ enum: DENOMINATIONS }) @IsInt() @IsIn(DENOMINATIONS) amountCents!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedSellerId?: string;
}
class RedeemDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) code!: string;
}
export class SaleDto {
  @ApiProperty({ description: 'Explicit confirmation of a simulated cash sale', example: true })
  @IsBoolean()
  @Equals(true)
  simulatedCashConfirmed!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) saleReference?: string;
}
@ApiTags('Coupons')
@ApiBearerAuth()
@Controller()
class CouponsController {
  constructor(
    private readonly service: CouponsService,
    private readonly db: Database,
  ) {}
  @Post('coupons/redeem')
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  redeem(@CurrentUser() user: Identity, @Body() body: RedeemDto) {
    return this.service.redeem(user, body.code);
  }
  @Post('admin/coupon-batches')
  @Roles(Role.ADMIN)
  @Header('Cache-Control', 'no-store')
  create(@CurrentUser() user: Identity, @Body() body: BatchDto) {
    return this.service.createBatch(user, body);
  }
  @Get('admin/coupon-batches')
  @Roles(Role.ADMIN)
  async batches(@Query() query: PageQuery) {
    const [items, total] = await this.db.$transaction([
      this.db.couponBatch.findMany({
        include: { _count: { select: { coupons: true } } },
        orderBy: { createdAt: 'desc' },
        ...paging(query),
      }),
      this.db.couponBatch.count(),
    ]);
    return pageResult(items, total, query);
  }
  @Get('admin/coupons') @Roles(Role.ADMIN) adminList(@Query() query: CouponQuery) {
    return this.service.list(query);
  }
  @Get('seller/coupons') @Roles(Role.SELLER) sellerList(
    @CurrentUser() user: Identity,
    @Query() query: CouponQuery,
  ) {
    return this.service.list(query, user.id);
  }
  @Get('seller/summary')
  @Roles(Role.SELLER)
  async sellerSummary(@CurrentUser() user: Identity) {
    const groups = await this.db.coupon.groupBy({
      by: ['status'],
      where: { assignedSellerId: user.id },
      _count: { _all: true },
    });
    return {
      isDemo: true,
      counts: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
    };
  }
  @Post('seller/coupons/:reference/activate')
  @Roles(Role.SELLER)
  activate(
    @CurrentUser() user: Identity,
    @Param('reference') reference: string,
    @Body() body: SaleDto,
  ) {
    return this.service.activate(user, reference, body.saleReference);
  }
  @Post('admin/coupons/:reference/activate')
  @Roles(Role.ADMIN)
  adminActivate(
    @CurrentUser() user: Identity,
    @Param('reference') reference: string,
    @Body() body: SaleDto,
  ) {
    return this.service.activate(user, reference, body.saleReference);
  }
  @Post('admin/coupons/:reference/void')
  @Roles(Role.ADMIN)
  void(@Param('reference') reference: string) {
    return this.service.void(reference);
  }
  @Get('admin/summary')
  @Roles(Role.ADMIN)
  async summary() {
    return this.db.$transaction(async (tx) => {
      const counts = await tx.coupon.groupBy({ by: ['status'], _count: { _all: true } });
      const batches = await tx.couponBatch.count();
      const sales = await tx.couponSale.aggregate({
        _sum: { amountCents: true },
        _count: { _all: true },
      });
      const students = await tx.user.count({ where: { role: Role.STUDENT, isActive: true } });
      return {
        isDemo: true,
        batches,
        counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
        salesCents: sales._sum.amountCents ?? 0,
        salesCount: sales._count._all,
        students,
      };
    });
  }
}
@Module({ controllers: [CouponsController], providers: [CouponsService] })
export class CouponsModule {}
