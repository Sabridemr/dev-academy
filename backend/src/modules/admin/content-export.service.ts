import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CONTENT_ASSET_PREFIX,
  LessonBlockSchema,
  LessonLevelSchema,
  serializeLesson,
  type LessonBlock,
  type LessonFrontmatter,
  type Quiz,
} from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';

/** Dışa aktarılan tek dosya; yol content/ köküne göredir (`modules/<modül>/<ders>/<dosya>`) */
export interface ExportedFile {
  path: string;
  content: string;
  /** Raster görseller base64, diğer her şey düz metin (utf8) */
  encoding: 'utf8' | 'base64';
}

export interface LessonExport {
  lessonId: string;
  moduleId: string;
  versionId: string;
  version: number;
  status: string;
  files: ExportedFile[];
  /** content/ biçiminin birebir taşıyamadığı bilgiler */
  warnings: string[];
}

export interface ExportOptions {
  /** Belirli bir sürüm (varsayılan: yayındaki sürüm, yoksa en son taslak) */
  versionId?: string;
  /**
   * Raster görselin dosya adını seçer (CLI, hedef klasördeki aynı içerikli dosyanın adını korur).
   * Verilmezse ya da undefined dönerse `gorsel-<sha256 ilk 12>.<uzantı>` kullanılır.
   */
  assetFileName?: (sha256: string, ext: string) => string | undefined;
}

/** Ders klasöründe güvenle yazılabilecek düz dosya adı (alt klasör ya da `..` yok) */
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ASSET_SRC = new RegExp(
  `^${CONTENT_ASSET_PREFIX.replace(/\//g, '\\/')}([a-f0-9]{64})\\.([a-z]+)$`,
);

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * VERİTABANI → content/ DIŞA AKTARIMI
 * -----------------------------------
 * Panelde düzenlenip yayınlanan bir dersi seed'in okuduğu dosya biçimine geri çevirir: `lesson.md`
 * (frontmatter + Markdown + directive'ler), gömülü SVG'ler `.svg`, sahneler `*.scene.json`, quiz
 * `quiz.json`, kod izleri `*.trace.json`, alıştırmalar `*.exercise.json`, raster görseller (base64). Seed'in dönüşümünün
 * (`resolveLessonBlocks`) tersidir: çıktı seed ile tekrar yüklendiğinde aynı blokları üretir.
 * Dosya sistemine yazmaz; CLI (`scripts/export-content.ts`) ve admin API'si dosya listesini kullanır.
 */
@Injectable()
export class ContentExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportLesson(lessonId: string, options: ExportOptions = {}): Promise<LessonExport> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { publishedVersion: true },
    });
    if (!lesson) throw new NotFoundException('Ders bulunamadı');
    const version = options.versionId
      ? await this.prisma.lessonVersion.findFirst({ where: { id: options.versionId, lessonId } })
      : (lesson.publishedVersion ??
        (await this.prisma.lessonVersion.findFirst({
          where: { lessonId },
          orderBy: { version: 'desc' },
        })));
    if (!version) throw new NotFoundException('Dışa aktarılacak sürüm bulunamadı');

    const warnings: string[] = [];
    const dir = `modules/${lesson.moduleId}/${lesson.id}`;
    const files: ExportedFile[] = [];
    const addFile = (
      name: string,
      content: string,
      encoding: ExportedFile['encoding'] = 'utf8',
    ) => {
      if (!SAFE_FILE.test(name)) {
        warnings.push(`'${name}' ders klasöründe geçerli bir dosya adı değil; dosya yazılmadı`);
        return false;
      }
      if (files.some((f) => f.path === `${dir}/${name}`)) return true;
      files.push({ path: `${dir}/${name}`, content, encoding });
      return true;
    };

    const rawBlocks = Array.isArray(version.blocks) ? version.blocks : [];
    const blocks: LessonBlock[] = [];
    rawBlocks.forEach((raw, i) => {
      const parsed = LessonBlockSchema.safeParse(raw);
      if (parsed.success) blocks.push(parsed.data);
      else warnings.push(`Blok ${i} şemaya uymuyor; atlandı`);
    });

    const exported: LessonBlock[] = [];
    for (const block of blocks) {
      exported.push(await this.exportBlock(block, lesson.id, addFile, warnings, options));
    }

    const level = LessonLevelSchema.safeParse(version.level);
    const meta: LessonFrontmatter = {
      id: lesson.id,
      slug: lesson.slug,
      module: lesson.moduleId,
      order: lesson.order,
      title: asLocalized(version.title),
      summary: asLocalized(version.summary),
      durationMinutes: version.durationMinutes,
      level: level.success ? level.data : 'beginner',
      tags: version.tags,
      prerequisites: version.prerequisites,
      concepts: version.concepts,
      status: version.status === 'draft' ? 'draft' : 'published',
    };
    const serialized = serializeLesson({ meta, blocks: exported });
    warnings.push(...serialized.warnings);
    files.unshift({ path: `${dir}/lesson.md`, content: serialized.markdown, encoding: 'utf8' });
    if (serialized.englishMarkdown !== null)
      files.splice(1, 0, {
        path: `${dir}/lesson.en.md`,
        content: serialized.englishMarkdown,
        encoding: 'utf8',
      });

    return {
      lessonId: lesson.id,
      moduleId: lesson.moduleId,
      versionId: version.id,
      version: version.version,
      status: version.status,
      files,
      warnings,
    };
  }

  /** Bloğu dosya biçimine indirger, başvurduğu dosyayı (svg, sahne, quiz, iz, alıştırma, görsel) ekler */
  private async exportBlock(
    block: LessonBlock,
    lessonId: string,
    addFile: (name: string, content: string, encoding?: ExportedFile['encoding']) => boolean,
    warnings: string[],
    options: ExportOptions,
  ): Promise<LessonBlock> {
    switch (block.type) {
      case 'diagram': {
        const { svg, width: _w, height: _h, ...rest } = block;
        const asset = ASSET_SRC.exec(block.src);
        if (asset) {
          const [, sha, ext] = asset;
          const row = await this.prisma.contentAsset.findUnique({ where: { id: sha } });
          if (!row) {
            warnings.push(`Görsel veritabanında yok: ${block.src}`);
            return rest;
          }
          const name = options.assetFileName?.(sha, ext) ?? `gorsel-${sha.slice(0, 12)}.${ext}`;
          addFile(name, Buffer.from(row.bytes).toString('base64'), 'base64');
          return { ...rest, src: name };
        }
        if (/^https?:\/\//.test(block.src)) return rest;
        // Birebir yazılır: seed dosyayı olduğu gibi gömer (sondaki satır sonu dahil)
        if (svg !== undefined) addFile(block.src, svg);
        else warnings.push(`Diyagram içeriği veritabanında yok: ${block.src}`);
        return rest;
      }
      case 'animation': {
        const { sceneId, ...rest } = block;
        const scene = sceneId
          ? await this.prisma.animationScene.findUnique({ where: { id: sceneId } })
          : await this.prisma.animationScene.findFirst({
              where: { lessonId, sourceFile: block.scene },
            });
        if (scene) {
          if (scene.status !== 'published')
            warnings.push(`Sahne yayında değil (${scene.status}): ${scene.id}`);
          addFile(block.scene, json(scene.data));
        } else warnings.push(`Sahne veritabanında yok: ${sceneId ?? block.scene}`);
        return rest;
      }
      case 'quiz': {
        const { quizId, ...rest } = block;
        const quiz = quizId
          ? await this.prisma.quiz.findUnique({
              where: { id: quizId },
              include: { questions: { where: { archived: false }, orderBy: { order: 'asc' } } },
            })
          : null;
        if (quiz) addFile(block.src, json(this.quizFile(quiz)));
        else warnings.push(`Quiz veritabanında yok: ${quizId ?? block.src}`);
        return rest;
      }
      case 'trace': {
        const { trace, ...rest } = block;
        if (trace) {
          addFile(block.src, json(trace));
          warnings.push(
            `${block.src}: kaynak '${block.src.replace(/\.json$/, '.py')}' veritabanında tutulmaz; content/ içindeki mevcut kaynak korunmalı`,
          );
        } else warnings.push(`Kod izi veritabanında yok: ${block.src}`);
        return rest;
      }
      case 'exercise': {
        const { exercise, solution, ...rest } = block;
        if (exercise && solution !== undefined) {
          // Alan sırası ExerciseSchema ile aynı (elle yazılan dosyalar gibi)
          const { id, title, language, prompt, starter, tests, hints, timeoutMs } = exercise;
          addFile(
            block.src,
            json({ id, title, language, prompt, starter, solution, tests, hints, timeoutMs }),
          );
        } else warnings.push(`Alıştırma veritabanında yok ya da çözümü eksik: ${block.src}`);
        return rest;
      }
      default:
        return block;
    }
  }

  private quizFile(quiz: {
    id: string;
    title: unknown;
    passScore: number;
    questions: {
      key: string;
      type: string;
      prompt: unknown;
      options: unknown;
      correct: string[];
      explanation: unknown;
      difficulty: string;
      concepts: string[];
    }[];
  }): Quiz {
    return {
      id: quiz.id,
      title: asLocalized(quiz.title as never),
      passScore: quiz.passScore,
      questions: quiz.questions.map((q) => ({
        id: q.key,
        type: q.type as Quiz['questions'][number]['type'],
        prompt: asLocalized(q.prompt as never),
        options: q.options as Quiz['questions'][number]['options'],
        correct: q.correct,
        explanation: asLocalized(q.explanation as never),
        difficulty: q.difficulty as Quiz['questions'][number]['difficulty'],
        concepts: q.concepts,
      })),
    };
  }

  /** Yayındaki tüm derslerin kimlikleri (CLI toplu dışa aktarımı için) */
  async publishedLessonIds(): Promise<string[]> {
    const rows = await this.prisma.lesson.findMany({
      where: { publishedVersionId: { not: null } },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
