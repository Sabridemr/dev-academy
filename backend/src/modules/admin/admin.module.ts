import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search/search.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MediaService } from './media.service';
import { ContentExportService } from './content-export.service';

@Module({
  imports: [ContentModule, SearchModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService, MediaService, ContentExportService],
  exports: [ContentExportService],
})
export class AdminModule {}
