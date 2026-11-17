import { Body, Controller, Module, Post, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { compare, hashSync } from 'bcryptjs';
import { Database } from '../common/database';
import { secret } from '../config';
import { Public, userSelect } from './security';

class LoginDto {
  @ApiProperty({ example: 'student@smartresto.local' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(72) password!: string;
}
const dummyHash = hashSync('unusable-dummy-password', 12);
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async login(@Body() body: LoginDto) {
    const account = await this.db.user.findUnique({ where: { email: body.email } });
    const valid = await compare(body.password, account?.passwordHash ?? dummyHash);
    if (!account?.isActive || !valid)
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: account.id },
      select: userSelect,
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user, expiresIn: 3600, isDemo: true };
  }
}
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: secret('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'smartresto',
          audience: 'smartresto-web',
        },
      }),
    }),
  ],
  controllers: [AuthController],
})
export class AuthModule {}
