import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Database } from '../common/database';

export const userSelect = {
  id: true,
  email: true,
  fullName: true,
  studentNumber: true,
  role: true,
  isActive: true,
} as const;
export type Identity = {
  id: string;
  email: string;
  fullName: string;
  studentNumber: string | null;
  role: Role;
  isActive: boolean;
};
export type AuthRequest = Request & { user: Identity };
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Identity =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: Database,
  ) {}
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Connexion requise.');
    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7), {
        algorithms: ['HS256'],
        issuer: 'smartresto',
        audience: 'smartresto-web',
      });
      if (typeof payload.sub !== 'string') throw new Error();
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException('Session expirée ou invalide.');
    }
    const user = await this.db.user.findUnique({ where: { id: subject }, select: userSelect });
    if (!user?.isActive) throw new UnauthorizedException('Compte indisponible.');
    request.user = user;
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('Accès non autorisé.');
    return true;
  }
}
