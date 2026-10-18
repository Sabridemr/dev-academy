import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('run-daily')
  @Roles('admin')
  @ApiOperation({ summary: 'Günlük hatırlatma işini elle tetikle (admin)' })
  run() {
    return this.notifications.sendDailyReminders();
  }
}
