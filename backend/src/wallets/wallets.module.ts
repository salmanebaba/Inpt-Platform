import { Controller, Get, Module, NotFoundException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Identity, Roles } from '../auth/security';
import { Database } from '../common/database';
import { pageResult, paging, TransactionQuery } from '../common/http';

@ApiTags('Demo wallets')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('wallet/me')
class WalletController {
  constructor(private readonly db: Database) {}
  @Get() async balance(@CurrentUser() user: Identity) {
    const wallet = await this.db.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) throw new NotFoundException('Portefeuille indisponible.');
    return {
      isDemo: true,
      currency: 'MAD',
      balanceCents: wallet.balanceCents,
      balanceFormatted: new Intl.NumberFormat('fr-MA', {
        style: 'currency',
        currency: 'MAD',
      }).format(wallet.balanceCents / 100),
    };
  }
  @Get('transactions') async transactions(
    @CurrentUser() user: Identity,
    @Query() query: TransactionQuery,
  ) {
    const where = { wallet: { userId: user.id }, type: query.type };
    const [items, total] = await this.db.$transaction([
      this.db.walletTransaction.findMany({
        where,
        include: { meal: true, coupon: { select: { publicSerial: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paging(query),
      }),
      this.db.walletTransaction.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
}
@Module({ controllers: [WalletController] })
export class WalletsModule {}
