import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { InteractiveTypeSchema, ReviewGradeSchema, UpdateProgressSchema } from '@devacademy/shared';
import type {
  BadgeDto,
  ProgressItem,
  ProgressSummary,
  ReviewGradeDto,
  UpdateProgressDto,
} from '@devacademy/shared';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { clampInt } from '../../common/utils/query';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { ProgressService } from './progress.service';

const InteractiveSchema = z.object({
  // Yalnızca bilinen simülatörler: rastgele adlarla "interaktif" rozeti kasılamaz
  interactive: InteractiveTypeSchema,
  lessonId: z.string().max(100).optional(),
  params: z
    .record(z.unknown())
    .refine((p) => JSON.stringify(p).length <= 2000, { message: 'params çok büyük' })
    .optional(),
});

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcının tüm ders ilerlemeleri' })
  list(@CurrentUser() user: AuthUser): Promise<ProgressItem[]> {
    return this.progress.list(user.id);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Özet: tamamlanma yüzdesi, seri, rozetler, devam edilecek ders, bekleyen tekrarlar',
  })
  summary(@CurrentUser() user: AuthUser): Promise<ProgressSummary> {
    return this.progress.summary(user.id);
  }

  @Put('lessons/:lessonId')
  @ApiOperation({ summary: 'Ders ilerlemesini güncelle (yüzde, son blok, süre, tamamlandı)' })
  @ApiZodBody(UpdateProgressSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body(zodBody(UpdateProgressSchema)) dto: UpdateProgressDto,
  ) {
    return this.progress.update(user.id, lessonId, dto);
  }

  @Post('interactive')
  @ApiOperation({ summary: 'İnteraktif simülatör oturumu kaydet (rozetler için)' })
  @ApiZodBody(InteractiveSchema)
  interactive(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(InteractiveSchema)) dto: z.infer<typeof InteractiveSchema>,
  ): Promise<BadgeDto[]> {
    return this.progress.recordInteractive(user.id, dto.interactive, dto.lessonId, dto.params);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Bugün tekrar edilmesi gereken kartlar (spaced repetition)' })
  @ApiQuery({ name: 'limit', required: false })
  reviews(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.progress.dueReviews(user.id, clampInt(limit, 20, 1, 50));
  }

  @Post('reviews/:cardId/grade')
  @ApiOperation({ summary: 'Tekrar kartını değerlendir (SM-2 kalite 0-5)' })
  @ApiZodBody(ReviewGradeSchema)
  grade(
    @CurrentUser() user: AuthUser,
    @Param('cardId') cardId: string,
    @Body(zodBody(ReviewGradeSchema)) dto: ReviewGradeDto,
  ) {
    return this.progress.gradeReview(user.id, cardId, dto.quality);
  }

  @Public()
  @Get('badges')
  @ApiOperation({ summary: 'Tüm rozet tanımları' })
  badges(): Promise<BadgeDto[]> {
    return this.progress.listBadges();
  }
}
