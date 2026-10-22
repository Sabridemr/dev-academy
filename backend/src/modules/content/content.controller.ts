import { Controller, Get, Header, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { LearningPathDetail, LearningPathSummary, LessonDetail, LessonSummary, ModuleDetail, ModuleSummary, SceneResponse } from '@devacademy/shared';
import { CurrentUser, OptionalAuth, Public, type AuthUser } from '../../common/auth/decorators';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor';
import { ContentService } from './content.service';

/**
 * Yayınlanmış içerik uç noktaları. Hepsi anonim erişime açık; token varsa ilerleme bilgisi eklenir.
 * ETag + Cache-Control ile istemci cache'i desteklenir. Token'lı isteklerde yanıt `private` olur
 * (EtagInterceptor), böylece kullanıcıya özel ilerleme paylaşılan cache'lere düşmez.
 */
@ApiTags('content')
@ApiBearerAuth()
@UseInterceptors(EtagInterceptor)
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('paths')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'Öğrenme yollarını listele' })
  listPaths(): Promise<LearningPathSummary[]> {
    return this.content.listPaths();
  }

  @OptionalAuth()
  @Get('paths/:idOrSlug')
  @ApiOperation({ summary: 'Öğrenme yolu detayı (modüller + kullanıcı ilerlemesi)' })
  getPath(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthUser): Promise<LearningPathDetail> {
    return this.content.getPath(idOrSlug, user?.id);
  }

  @OptionalAuth()
  @Get('modules')
  @ApiOperation({ summary: 'Modülleri listele' })
  listModules(@CurrentUser() user?: AuthUser): Promise<ModuleSummary[]> {
    return this.content.listModules(user?.id);
  }

  @OptionalAuth()
  @Get('modules/:idOrSlug')
  @ApiOperation({ summary: 'Modül detayı (dersler + ilerleme)' })
  getModule(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthUser): Promise<ModuleDetail> {
    return this.content.getModule(idOrSlug, user?.id);
  }

  @Public()
  @Get('lessons')
  @ApiOperation({ summary: 'Yayınlanmış dersleri listele' })
  @ApiQuery({ name: 'moduleId', required: false })
  listLessons(@Query('moduleId') moduleId?: string): Promise<LessonSummary[]> {
    return this.content.listLessons(moduleId);
  }

  @OptionalAuth()
  @Get('lessons/:idOrSlug')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
  @ApiOperation({ summary: 'Ders detayı: bloklar, komşu dersler, ilerleme' })
  getLesson(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthUser): Promise<LessonDetail> {
    return this.content.getLesson(idOrSlug, user?.id);
  }

  @Get('lessons/:lessonId/exercises/:exerciseId/solution')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Kodlama alıştırmasının örnek çözümü (oturum gerekir)',
    description:
      'Ders detayındaki alıştırma bloklarında çözüm yoktur. Web istemcisi düğmeyi 3 başarısız test denemesinden sonra açar.',
  })
  getExerciseSolution(@Param('lessonId') lessonId: string, @Param('exerciseId') exerciseId: string): Promise<{ solution: string }> {
    return this.content.getExerciseSolution(lessonId, exerciseId);
  }

  @Public()
  @Get('lessons/:lessonId/scenes')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Dersin animasyon sahneleri' })
  listLessonScenes(@Param('lessonId') lessonId: string): Promise<SceneResponse[]> {
    return this.content.listLessonScenes(lessonId);
  }

  @Public()
  @Get('scenes/:id')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Animasyon sahnesi JSON' })
  getScene(@Param('id') id: string): Promise<SceneResponse> {
    return this.content.getScene(id);
  }
}
