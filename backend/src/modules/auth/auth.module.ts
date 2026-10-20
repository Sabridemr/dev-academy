import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthVerifierService } from './oauth-verifier.service';

@Global()
@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, OAuthVerifierService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
