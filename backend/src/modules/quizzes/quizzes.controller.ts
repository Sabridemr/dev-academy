import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SubmitAttemptSchema } from '@devacademy/shared';
import type { AttemptResult, QuizPublic, SubmitAttemptDto } from '@devacademy/shared';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { QuizzesService } from './quizzes.service';

@ApiTags('quizzes')
@ApiBearerAuth()
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Public()
  @Get('by-lesson/:lessonId')
  @ApiOperation({ summary: 'Dersin quizini getir (doğru cevaplar gizli)' })
  byLesson(@Param('lessonId') lessonId: string): Promise<QuizPublic> {
    return this.quizzes.getLessonQuiz(lessonId);
  }

  @Get('attempts')
  @ApiOperation({ summary: 'Kullanıcının quiz denemeleri' })
  @ApiQuery({ name: 'quizId', required: false })
  attempts(@CurrentUser() user: AuthUser, @Query('quizId') quizId?: string) {
    return this.quizzes.listAttempts(user.id, quizId);
  }

  @Public()
  @Get(':quizId')
  @ApiOperation({ summary: 'Quiz getir (doğru cevaplar gizli)' })
  get(@Param('quizId') quizId: string): Promise<QuizPublic> {
    return this.quizzes.getQuiz(quizId);
  }

  @Post(':quizId/attempts')
  @ApiOperation({ summary: 'Quiz cevaplarını gönder; puan, açıklamalar ve kazanılan rozetler döner' })
  @ApiZodBody(SubmitAttemptSchema)
  submit(@CurrentUser() user: AuthUser, @Param('quizId') quizId: string, @Body(zodBody(SubmitAttemptSchema)) dto: SubmitAttemptDto): Promise<AttemptResult> {
    return this.quizzes.submit(user.id, quizId, dto);
  }
}
