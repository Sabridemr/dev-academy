import { Global, Module } from '@nestjs/common';
import { AuthStateService } from './auth-state.service';

@Global()
@Module({
  providers: [AuthStateService],
  exports: [AuthStateService],
})
export class AuthStateModule {}
