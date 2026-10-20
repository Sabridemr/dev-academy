import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [ProgressModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
