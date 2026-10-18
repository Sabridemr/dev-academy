import { Controller, Get, Header, Param, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OfflineBundle } from '@devacademy/shared';
import { Public } from '../../common/auth/decorators';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ContentService } from '../content/content.service';
import { toPublic } from '../quizzes/quizzes.service';

/**
 * Mobil offline modu: bir modülün tüm yayınlanmış dersleri, sahneleri ve quizleri tek pakette.
 * İstemci ETag ile değişiklik kontrolü yapar, paketi SQLite/MMKV'ye yazar.
 */
@ApiTags('offline')
@UseInterceptors(EtagInterceptor)
@Controller('offline')
export class OfflineController {
  constructor(
    private readonly content: ContentService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('modules/:moduleId')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Modül offline paketi (dersler + sahneler + quizler)' })
  async bundle(@Param('moduleId') moduleId: string): Promise<OfflineBundle> {
    const module = await this.content.getModule(moduleId);
    const lessons = await Promise.all(module.lessons.map((l) => this.content.getLesson(l.id)));
    const scenes = (await Promise.all(module.lessons.map((l) => this.content.listLessonScenes(l.id)))).flat();
    const quizRows = await this.prisma.quiz.findMany({ where: { lessonId: { in: module.lessons.map((l) => l.id) }, status: 'published' }, include: { questions: { orderBy: { order: 'asc' } } } });
    return { generatedAt: new Date().toISOString(), moduleId: module.id, lessons, scenes, quizzes: quizRows.map(toPublic) };
  }
}
