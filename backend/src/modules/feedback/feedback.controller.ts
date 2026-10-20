import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LessonFeedbackSchema } from '@devacademy/shared';
import type { LessonFeedbackDto, LessonFeedbackSummary } from '@devacademy/shared';
import { CurrentUser, OptionalAuth, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller('lessons/:lessonId/feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ders geri bildirimi gönder/güncelle (beğeni, zorluk, yorum)' })
  @ApiZodBody(LessonFeedbackSchema)
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body(zodBody(LessonFeedbackSchema)) dto: LessonFeedbackDto,
  ): Promise<LessonFeedbackSummary> {
    return this.feedback.upsert(user.id, lessonId, dto);
  }

  @OptionalAuth()
  @Get()
  @ApiOperation({ summary: 'Ders geri bildirim özeti (oturum varsa kullanıcının kendi oyu: mine)' })
  summary(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<LessonFeedbackSummary> {
    return this.feedback.summary(lessonId, user?.id);
  }
}
