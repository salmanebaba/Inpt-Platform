import './config';
import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Database, DatabaseModule } from './common/database';
import { AccessGuard, Public } from './auth/security';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { CouponsModule } from './coupons/coupons.module';
import { MealsModule } from './meals/meals.module';
import { SalesModule } from './sales/sales.module';
import { DemoRestaurantAdapter } from './integrations/restaurant.port';
@Controller()
class HealthController {
  constructor(private readonly db: Database) {}
  @Public() @Get('health') async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Base de données indisponible.');
    }
    return { status: 'ok', database: 'ok', isDemo: true };
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    CouponsModule,
    MealsModule,
    SalesModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    DemoRestaurantAdapter,
  ],
})
export class AppModule {}
