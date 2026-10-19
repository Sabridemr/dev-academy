import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [RealtimeModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
