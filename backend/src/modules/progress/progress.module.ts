import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [RealtimeModule, CertificatesModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
