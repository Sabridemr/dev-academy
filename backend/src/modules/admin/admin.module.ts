import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search/search.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MediaService } from './media.service';

@Module({
  imports: [ContentModule, SearchModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService, MediaService],
})
export class AdminModule {}
