import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CONTENT_ASSET_PREFIX, rasterExtension } from '@devacademy/shared';
import { loadContent, type LoadedContent, type LoadedLesson } from '@devacademy/shared/node';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { ContentExportService } from './content-export.service';
import { canonical, resolveLessonBlocks, type StoredAsset } from './content-sync';

/**
 * Dışa aktarım gidiş-dönüşü: depodaki gerçek içerik seed'in yaptığı gibi "veritabanına" (bellek içi
 * sahte Prisma) yazılır, her ders dışa aktarılıp geçici bir content/ klasörüne yazılır ve yükleyiciyle
 * yeniden okunur. Beklenti: doğrulama sorunu yok ve seed'in üreteceği bloklar birebir aynı.
 */
const CONTENT = resolve(__dirname, '../../../../content');

function storedAssets(lesson: LoadedLesson): Record<string, StoredAsset> {
  const out: Record<string, StoredAsset> = {};
  for (const [file, img] of Object.entries(lesson.images)) {
    const ext = rasterExtension(file)!;
    const sha = createHash('sha256').update(readFileSync(img.path)).digest('hex');
    out[file] = {
      src: `${CONTENT_ASSET_PREFIX}${sha}.${ext === 'jpeg' ? 'jpg' : ext}`,
      width: img.width,
      height: img.height,
    };
  }
  return out;
}

/** Seed'in yazdığı satırları taklit eden bellek içi Prisma */
function fakePrisma(content: LoadedContent) {
  const lessons = new Map<string, unknown>();
  const scenes = new Map<string, unknown>();
  const quizzes = new Map<string, unknown>();
  const assets = new Map<string, { bytes: Buffer }>();
  for (const m of content.modules) {
    for (const l of m.lessons) {
      const meta = l.doc.meta;
      for (const [file, img] of Object.entries(l.images)) {
        const bytes = readFileSync(img.path);
        void file;
        assets.set(createHash('sha256').update(bytes).digest('hex'), { bytes });
      }
      for (const s of l.scenes)
        scenes.set(s.scene.id, {
          id: s.scene.id,
          data: s.scene,
          status: 'published',
          lessonId: meta.id,
          sourceFile: s.file,
        });
      if (l.quiz)
        quizzes.set(l.quiz.id, {
          id: l.quiz.id,
          title: l.quiz.title,
          passScore: l.quiz.passScore,
          questions: l.quiz.questions.map((q, i) => ({ ...q, key: q.id, order: i })),
        });
      lessons.set(meta.id, {
        id: meta.id,
        slug: meta.slug,
        moduleId: meta.module,
        order: meta.order,
        publishedVersion: {
          id: `v-${meta.id}`,
          version: 1,
          status: meta.status,
          title: meta.title,
          summary: meta.summary,
          durationMinutes: meta.durationMinutes,
          level: meta.level,
          tags: meta.tags,
          prerequisites: meta.prerequisites,
          concepts: meta.concepts,
          // jsonb gidiş-dönüşü: undefined alanlar düşer
          blocks: JSON.parse(JSON.stringify(resolveLessonBlocks(l, storedAssets(l)))),
        },
      });
    }
  }
  return {
    lesson: { findUnique: jest.fn(async ({ where }) => lessons.get(where.id) ?? null) },
    lessonVersion: { findFirst: jest.fn(async () => null) },
    contentAsset: { findUnique: jest.fn(async ({ where }) => assets.get(where.id) ?? null) },
    animationScene: {
      findUnique: jest.fn(async ({ where }) => scenes.get(where.id) ?? null),
      findFirst: jest.fn(async () => null),
    },
    quiz: { findUnique: jest.fn(async ({ where }) => quizzes.get(where.id) ?? null) },
  } as unknown as PrismaService;
}

describe('ContentExportService', () => {
  let original: LoadedContent;
  let out = '';

  beforeAll(() => {
    original = loadContent(CONTENT);
  });
  afterAll(() => {
    if (out) rmSync(out, { recursive: true, force: true });
  });

  it('tüm dersler dışa aktarılıp yeniden yüklendiğinde seed aynı blokları üretir', async () => {
    const service = new ContentExportService(fakePrisma(original));
    out = mkdtempSync(join(tmpdir(), 'da-export-'));
    copyFileSync(join(CONTENT, 'paths.json'), join(out, 'paths.json'));
    const unexpectedWarnings: string[] = [];
    for (const m of original.modules) {
      mkdirSync(join(out, 'modules', m.manifest.id), { recursive: true });
      copyFileSync(join(m.dir, 'module.json'), join(out, 'modules', m.manifest.id, 'module.json'));
      for (const l of m.lessons) {
        const result = await service.exportLesson(l.doc.meta.id);
        for (const f of result.files) {
          const target = join(out, f.path);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(
            target,
            Buffer.from(f.content, f.encoding === 'base64' ? 'base64' : 'utf8'),
          );
        }
        // Kod izinin .py kaynağı veritabanında yok: mevcut kaynak korunur (CLI aynı klasöre yazar)
        for (const t of Object.keys(l.traces)) {
          const py = t.replace(/\.json$/, '.py');
          copyFileSync(join(l.dir, py), join(out, 'modules', m.manifest.id, l.doc.meta.id, py));
        }
        unexpectedWarnings.push(
          ...result.warnings.filter((w) => !/veritabanında tutulmaz|gövdede ':::'/.test(w)),
        );
      }
    }
    expect(unexpectedWarnings).toEqual([]);

    const reloaded = loadContent(out);
    expect(reloaded.issues).toEqual(original.issues);

    const byId = new Map(
      reloaded.modules.flatMap((m) => m.lessons.map((l) => [l.doc.meta.id, l] as const)),
    );
    let compared = 0;
    for (const m of original.modules) {
      for (const l of m.lessons) {
        const again = byId.get(l.doc.meta.id);
        expect(again).toBeDefined();
        expect(again!.doc.meta).toEqual(l.doc.meta);
        expect(canonical(resolveLessonBlocks(again!, storedAssets(again!)))).toEqual(
          canonical(resolveLessonBlocks(l, storedAssets(l))),
        );
        expect(again!.quiz).toEqual(l.quiz);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(50);
  });

  it('ders yoksa 404', async () => {
    const service = new ContentExportService({
      lesson: { findUnique: jest.fn(async () => null) },
    } as unknown as PrismaService);
    await expect(service.exportLesson('yok')).rejects.toThrow('Ders bulunamadı');
  });

  it('veritabanında olmayan sahne ve quiz uyarı olarak döner; dosya adı güvenliği', async () => {
    const service = new ContentExportService({
      lesson: {
        findUnique: jest.fn(async () => ({
          id: 'x-01-ders',
          slug: 'ders',
          moduleId: 'x-modul',
          order: 1,
          publishedVersion: {
            id: 'v1',
            version: 3,
            status: 'published',
            title: { tr: 'Ders', en: 'Lesson' },
            summary: 'Özet',
            durationMinutes: 10,
            level: 'beginner',
            tags: [],
            prerequisites: [],
            concepts: [],
            blocks: [
              { id: 'p', order: 0, type: 'text', markdown: 'Merhaba' },
              { id: 'a', order: 1, type: 'animation', scene: 'yok.scene.json', sceneId: 'yok' },
              { id: 'q', order: 2, type: 'quiz', src: 'quiz.json', quizId: 'yok' },
              {
                id: 'd',
                order: 3,
                type: 'diagram',
                src: '../kacis.svg',
                alt: 'x',
                svg: '<svg viewBox="0 0 1 1"/>',
              },
            ],
          },
        })),
      },
      animationScene: { findUnique: jest.fn(async () => null) },
      quiz: { findUnique: jest.fn(async () => null) },
    } as unknown as PrismaService);
    const result = await service.exportLesson('x-01-ders');
    expect(result.files.map((f) => f.path)).toEqual(['modules/x-modul/x-01-ders/lesson.md']);
    expect(result.warnings.join('\n')).toMatch(/Sahne veritabanında yok/);
    expect(result.warnings.join('\n')).toMatch(/Quiz veritabanında yok/);
    expect(result.warnings.join('\n')).toMatch(/geçerli bir dosya adı değil/);
    expect(result.files[0].content).toContain(':::animation{scene="yok.scene.json"}');
  });
});
