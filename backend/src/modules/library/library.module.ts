import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  imports: [ProgressModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
