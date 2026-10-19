import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  AdminLessonUpsertSchema,
  AdminQuizUpsertSchema,
  AdminSceneUpsertSchema,
} from '@devacademy/shared';
import type {
  AdminLessonUpsertDto,
  AdminQuizUpsertDto,
  AdminSceneUpsertDto,
} from '@devacademy/shared';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { AdminService } from './admin.service';
import { clampInt } from '../../common/utils/query';
import { MediaService } from './media.service';

const PublishSchema = z.object({ versionId: z.string().optional() });
const PresignSchema = z.object({ contentType: z.string().min(3), folder: z.string().optional() });
const ModuleSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  code: z.string().min(1).max(3),
  order: z.number().int().min(1),
  title: z.union([z.string(), z.object({ tr: z.string(), en: z.string().optional() })]),
  description: z.union([z.string(), z.object({ tr: z.string(), en: z.string().optional() })]),
  icon: z.string().optional(),
  color: z.string().optional(),
});

/** İçerik yönetimi — yalnızca editor ve admin rolleri. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('editor', 'admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly media: MediaService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Panel istatistikleri' })
  stats() {
    return this.admin.stats();
  }

  /* Dersler */
  @Get('lessons')
  @ApiOperation({ summary: 'Tüm dersler (taslak/yayın sürüm numaralarıyla)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  lessons(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.listLessons(clampInt(page, 1, 1, 10_000), clampInt(pageSize, 50, 1, 200));
  }

  @Get('lessons/:lessonId/versions')
  @ApiOperation({ summary: 'Dersin sürüm geçmişi' })
  versions(@Param('lessonId') lessonId: string) {
    return this.admin.getLessonVersions(lessonId);
  }

  @Get('versions/:versionId')
  @ApiOperation({ summary: 'Sürüm içeriği (bloklar dahil)' })
  version(@Param('versionId') versionId: string) {
    return this.admin.getVersion(versionId);
  }

  @Put('lessons')
  @ApiOperation({ summary: 'Ders taslağı oluştur/güncelle' })
  @ApiZodBody(AdminLessonUpsertSchema)
  upsertLesson(
    @Body(zodBody(AdminLessonUpsertSchema)) dto: AdminLessonUpsertDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.upsertDraft(dto, user.id);
  }

  @Post('lessons/:lessonId/fork')
  @ApiOperation({ summary: 'Yayındaki sürümden yeni taslak türet' })
  fork(@Param('lessonId') lessonId: string, @CurrentUser() user: AuthUser) {
    return this.admin.forkDraft(lessonId, user.id);
  }

  @Post('lessons/:lessonId/publish')
  @ApiOperation({ summary: 'Taslağı yayınla (cache temizlenir, istemcilere WS bildirimi gider)' })
  @ApiZodBody(PublishSchema)
  publish(
    @Param('lessonId') lessonId: string,
    @Body(zodBody(PublishSchema)) dto: z.infer<typeof PublishSchema>,
  ) {
    return this.admin.publish(lessonId, dto.versionId);
  }

  @Post('lessons/:lessonId/unpublish')
  @ApiOperation({ summary: 'Dersi yayından kaldır' })
  unpublish(@Param('lessonId') lessonId: string) {
    return this.admin.unpublish(lessonId);
  }

  /* Modüller */
  @Put('modules')
  @ApiOperation({ summary: 'Modül oluştur/güncelle' })
  @ApiZodBody(ModuleSchema)
  upsertModule(@Body(zodBody(ModuleSchema)) dto: z.infer<typeof ModuleSchema>) {
    return this.admin.upsertModule(dto);
  }

  /* Sahneler */
  @Get('scenes')
  @ApiOperation({ summary: 'Sahneleri listele' })
  @ApiQuery({ name: 'lessonId', required: false })
  scenes(@Query('lessonId') lessonId?: string) {
    return this.admin.listScenes(lessonId);
  }

  @Get('scenes/:id')
  @ApiOperation({ summary: 'Sahne (taslak dahil)' })
  scene(@Param('id') id: string) {
    return this.admin.getScene(id);
  }

  @Put('scenes')
  @ApiOperation({ summary: 'Sahne kaydet (şema doğrulamasıyla); ?publish=true ile yayınla' })
  @ApiQuery({ name: 'publish', required: false })
  @ApiZodBody(AdminSceneUpsertSchema)
  upsertScene(
    @Body(zodBody(AdminSceneUpsertSchema)) dto: AdminSceneUpsertDto,
    @CurrentUser() user: AuthUser,
    @Query('publish') publish?: string,
  ) {
    return this.admin.upsertScene(dto, user.id, publish === 'true');
  }

  @Post('scenes/:id/publish')
  @ApiOperation({ summary: 'Sahneyi yayınla' })
  publishScene(@Param('id') id: string) {
    return this.admin.publishScene(id);
  }

  @Delete('scenes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @ApiOperation({ summary: 'Sahneyi sil' })
  deleteScene(@Param('id') id: string) {
    return this.admin.deleteScene(id);
  }

  /* Quiz */
  @Get('quizzes/:quizId')
  @ApiOperation({ summary: 'Quiz (doğru cevaplar dahil)' })
  quiz(@Param('quizId') quizId: string) {
    return this.admin.getQuizFull(quizId);
  }

  @Put('quizzes')
  @ApiOperation({ summary: 'Quiz oluştur/güncelle' })
  @ApiZodBody(AdminQuizUpsertSchema)
  upsertQuiz(@Body(zodBody(AdminQuizUpsertSchema)) dto: AdminQuizUpsertDto) {
    return this.admin.upsertQuiz(dto);
  }

  /* Medya */
  @Post('media/presign')
  @ApiOperation({ summary: 'S3 ön imzalı yükleme formu (presigned POST, boyut sınırlı)' })
  @ApiZodBody(PresignSchema)
  presign(@Body(zodBody(PresignSchema)) dto: z.infer<typeof PresignSchema>) {
    return this.media.presignUpload(dto.contentType, dto.folder);
  }
}
