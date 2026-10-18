import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { OfflineController } from './offline.controller';

@Module({
  imports: [ContentModule],
  controllers: [OfflineController],
})
export class OfflineModule {}
