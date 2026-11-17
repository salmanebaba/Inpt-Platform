import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser, Identity, Roles, userSelect } from '../auth/security';
import { Database } from '../common/database';
import { PageQuery, pageResult, paging } from '../common/http';
class UserQuery extends PageQuery {
  @IsOptional() @IsEnum(Role) role?: Role;
}
@ApiTags('Users')
@ApiBearerAuth()
@Controller()
class UsersController {
  constructor(private readonly db: Database) {}
  @Get('users/me') me(@CurrentUser() user: Identity) {
    return user;
  }
  @Get('admin/users')
  @Roles(Role.ADMIN)
  async users(@Query() query: UserQuery) {
    const where = { isActive: true, role: query.role };
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: userSelect,
        orderBy: { fullName: 'asc' },
        ...paging(query),
      }),
      this.db.user.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
}
@Module({ controllers: [UsersController] })
export class UsersModule {}
