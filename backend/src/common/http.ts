import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  ValidationPipe,
  INestApplication,
} from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CouponStatus, TransactionType } from '@prisma/client';
import { Request, Response } from 'express';
import helmet from 'helmet';

export class PageQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class CouponQuery extends PageQuery {
  @ApiPropertyOptional({ enum: CouponStatus })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
}
export class TransactionQuery extends PageQuery {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}
export function paging(query: PageQuery) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}
export function pageResult<T>(items: T[], total: number, query: PageQuery) {
  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
    isDemo: true,
  };
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    let message =
      typeof body === 'string'
        ? body
        : body && typeof body === 'object' && 'message' in body
          ? body.message
          : 'Erreur interne du serveur.';
    if (status === 429) message = 'Trop de tentatives. Veuillez réessayer dans une minute.';
    if (status === 400 && Array.isArray(message)) {
      message = 'Données invalides. Vérifiez les champs du formulaire.';
    }
    // Never include database errors, request bodies or coupon codes in error output/logs.
    response.status(status).json({
      statusCode: status,
      message,
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }
}
export function configureHttp(app: INestApplication) {
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: false,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ErrorFilter());
}
