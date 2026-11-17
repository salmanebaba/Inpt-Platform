import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MealType, Role } from '@prisma/client';
import { Database } from '../common/database';
import { PageQuery, pageResult, paging } from '../common/http';
import { CurrentUser, Identity, Roles } from '../auth/security';

class MealDto {
  @ApiProperty() @IsUUID() studentId!: string;
  @ApiProperty({ enum: MealType }) @IsEnum(MealType) type!: MealType;
  @ApiPropertyOptional({ default: 140 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  priceCents?: number;
}
class StatsQuery {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
export function casablancaMonthStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const first = new Date(
    Date.UTC(
      Number(parts.find((p) => p.type === 'year')!.value),
      Number(parts.find((p) => p.type === 'month')!.value) - 1,
      1,
    ),
  );
  const offset = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Casablanca',
    timeZoneName: 'longOffset',
  })
    .formatToParts(first)
    .find((p) => p.type === 'timeZoneName')!.value;
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  return new Date(
    first.getTime() -
      (match
        ? (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60000
        : 0),
  );
}
@Injectable()
export class MealsService {
  constructor(private readonly db: Database) {}
  async simulate(body: MealDto) {
    const price = body.priceCents ?? Number(process.env.MEAL_PRICE_CENTS ?? 140);
    return this.db.atomic(async (tx) => {
      const student = await tx.user.findUnique({ where: { id: body.studentId } });
      if (student?.role !== Role.STUDENT || !student.isActive)
        throw new BadRequestException('Étudiant indisponible.');
      const changed = await tx.wallet.updateMany({
        where: { userId: body.studentId, balanceCents: { gte: price } },
        data: { balanceCents: { decrement: price } },
      });
      if (changed.count !== 1) throw new ConflictException('Solde de démonstration insuffisant.');
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: body.studentId } });
      const meal = await tx.meal.create({
        data: { userId: body.studentId, type: body.type, priceCents: price },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'MEAL_DEBIT',
          amountCents: -price,
          balanceAfterCents: wallet.balanceCents,
          mealId: meal.id,
        },
      });
      return {
        isDemo: true,
        meal,
        transactionId: transaction.id,
        balanceCents: wallet.balanceCents,
      };
    });
  }
}
@ApiTags('Demo meals')
@ApiBearerAuth()
@Controller()
class MealsController {
  constructor(
    private readonly db: Database,
    private readonly service: MealsService,
  ) {}
  @Post('admin/demo/meals')
  @Roles(Role.ADMIN)
  simulate(@Body() body: MealDto) {
    return this.service.simulate(body);
  }
  @Get('meals/me')
  @Roles(Role.STUDENT)
  async meals(@CurrentUser() user: Identity, @Query() query: PageQuery) {
    const where = { userId: user.id };
    const [items, total] = await this.db.$transaction([
      this.db.meal.findMany({
        where,
        orderBy: [{ consumedAt: 'desc' }, { id: 'desc' }],
        ...paging(query),
      }),
      this.db.meal.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  @Get('meals/me/stats')
  @Roles(Role.STUDENT)
  async stats(@CurrentUser() user: Identity, @Query() query: StatsQuery) {
    const from = query.from ? new Date(query.from) : casablancaMonthStart();
    const to = query.to ? new Date(query.to) : new Date();
    if (from > to) throw new BadRequestException('La date de début doit précéder la date de fin.');
    const groups = await this.db.meal.groupBy({
      by: ['type'],
      where: { userId: user.id, consumedAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { priceCents: true },
    });
    const counts = { BREAKFAST: 0, LUNCH: 0, DINNER: 0 };
    let totalSpentCents = 0;
    for (const group of groups) {
      counts[group.type] = group._count._all;
      totalSpentCents += group._sum.priceCents ?? 0;
    }
    return {
      isDemo: true,
      from,
      to,
      counts,
      totalMeals: Object.values(counts).reduce((a, b) => a + b, 0),
      totalSpentCents,
    };
  }
}
@Module({ controllers: [MealsController], providers: [MealsService] })
export class MealsModule {}
