import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async atomic<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.$transaction(work, {
          isolationLevel: 'Serializable',
          maxWait: 10000,
          timeout: 10000,
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034')
          throw error;
        if (attempt === 3)
          throw new ServiceUnavailableException('Opération occupée, veuillez réessayer.');
        await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
      }
    }
    throw new ServiceUnavailableException();
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
