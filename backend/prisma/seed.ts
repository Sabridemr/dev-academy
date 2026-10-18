/**
 * SEED
 * ----
 * content/ klasöründeki müfredatı (modüller, dersler, sahneler, quizler, öğrenme yolları) ve
 * rozet tanımlarını veritabanına yükler. İdempotenttir: tekrar çalıştırıldığında mevcut kayıtları günceller,
 * yayındaki ders sürümünü yalnızca içerik değiştiyse yeni sürüm olarak yayınlar.
 *
 * Çalıştır: pnpm db:seed   (CONTENT_DIR ile klasör değiştirilebilir)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import {
  BADGES,
  CURRICULUM,
  LEARNING_PATHS,
  lessonPlainText,
  type LessonBlock,
  type LocalizedString,
} from '@devacademy/shared';
import { coverageReport, loadContent, type LoadedLesson } from '@devacademy/shared/node';

const prisma = new PrismaClient();

function loc(v: LocalizedString): Prisma.InputJsonValue {
  return typeof v === 'string' ? v : { tr: v.tr, ...(v.en ? { en: v.en } : {}) };
}
function json(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}
/** jsonb anahtar sırasını değiştirir ve undefined alanları atar; karşılaştırma için kanonik biçim */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, val]) => val !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, canonical(val)]),
    );
  }
  return v;
}
function hash(v: unknown): string {
  return createHash('sha1')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
}

/** Ders bloklarını veritabanına yazılabilir hâle getirir: SVG'ler inline, sahne/quiz id'leri çözülmüş */
function resolveBlocks(lesson: LoadedLesson): LessonBlock[] {
  return lesson.doc.blocks.map((b) => {
    switch (b.type) {
      case 'diagram':
        return { ...b, svg: lesson.svgs[b.src] };
      case 'animation': {
        const scene = lesson.scenes.find((s) => s.file === b.scene);
        return { ...b, sceneId: scene?.scene.id };
      }
      case 'quiz':
        return { ...b, quizId: lesson.quiz?.id };
      default:
        return b;
    }
  });
}

async function seedBadges(): Promise<void> {
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: { title: loc(b.title), description: loc(b.description), icon: b.icon },
      create: { slug: b.slug, title: loc(b.title), description: loc(b.description), icon: b.icon },
    });
  }
  console.log(`✓ ${BADGES.length} rozet`);
}

/**
 * Admin hesabını yalnızca yoksa oluşturur. Aynı e-postayla var olan bir hesabın rolüne dokunulmaz
 * (seed, kayıtlı herhangi bir kullanıcıyı admin yapamasın). Üretimde şifre ortam değişkeniyle verilmelidir.
 */
async function seedAdmin(): Promise<string | null> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@devacademy.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'admin') {
      console.warn(`⚠ ${email} kayıtlı ama admin değil; rolü değiştirilmedi`);
      return null;
    }
    console.log(`✓ admin kullanıcı mevcut: ${email}`);
    return existing.id;
  }
  let password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('SEED_ADMIN_PASSWORD üretimde zorunludur');
    console.warn('⚠ SEED_ADMIN_PASSWORD verilmedi; varsayılan geliştirme şifresi kullanılıyor');
    password = 'Admin123!';
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const admin = await prisma.user.create({
    data: { email, passwordHash, displayName: 'DevAcademy Admin', role: 'admin', locale: 'tr' },
  });
  console.log(`✓ admin kullanıcı oluşturuldu: ${email}`);
  return admin.id;
}

/** API'nin Redis içerik ve arama cache'ini temizler; aksi hâlde yeni içerik TTL dolana kadar görünmez */
async function clearApiCache(): Promise<void> {
  if (process.env.SEED_SKIP_REDIS === '1') return;
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    await redis.connect();
    let removed = 0;
    for (const pattern of ['content:*', 'search:*']) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length) removed += await redis.del(...keys);
      } while (cursor !== '0');
    }
    console.log(`✓ Redis cache temizlendi (${removed} anahtar)`);
  } catch (err) {
    console.warn(`⚠ Redis cache temizlenemedi: ${(err as Error).message}`);
  } finally {
    redis.disconnect();
  }
}

type VersionFields = {
  title: unknown;
  summary: unknown;
  durationMinutes: number;
  level: unknown;
  tags: string[];
  prerequisites: string[];
  concepts: string[];
  blocks: unknown;
};
function versionFingerprint(v: VersionFields): string {
  return hash({
    title: v.title,
    summary: v.summary,
    durationMinutes: v.durationMinutes,
    level: v.level,
    tags: v.tags,
    prerequisites: v.prerequisites,
    concepts: v.concepts,
    blocks: v.blocks,
  });
}

async function main(): Promise<void> {
  const contentDir = resolve(process.cwd(), process.env.CONTENT_DIR ?? '../content');
  console.log(`İçerik kökü: ${contentDir}`);
  const content = loadContent(contentDir);
  const errors = content.issues.filter((i) => i.severity === 'error');
  const strict = process.argv.includes('--strict') || process.env.SEED_STRICT === '1';
  if (errors.length && strict) {
    console.error(`İçerikte ${errors.length} hata var; --strict modunda seed durduruldu:`);
    for (const e of errors) console.error(`  ✗ ${e.file}: ${e.message}`);
    process.exit(1);
  }
  // Hatalı dersleri atla (ders klasörü yolu hata dosya yolunun öneki ise)
  const brokenLessonDirs = new Set(
    errors
      .map((e) => e.file.split('/').slice(0, 3).join('/'))
      .filter((p) => p.split('/').length === 3),
  );
  if (errors.length) {
    console.warn(
      `⚠ İçerikte ${errors.length} hata var; etkilenen ${brokenLessonDirs.size} ders atlanacak (tam doğrulama için --strict):`,
    );
    for (const e of errors) console.warn(`  ✗ ${e.file}: ${e.message}`);
  }
  for (const m of content.modules) {
    m.lessons = m.lessons.filter((l) => {
      const rel = `modules/${m.manifest.id}/${l.doc.meta.id}`;
      return !brokenLessonDirs.has(rel);
    });
  }
  const coverage = coverageReport(content);
  console.log(`Müfredat kapsamı: ${coverage.written}/${coverage.total} ders`);

  await seedBadges();
  const adminId = await seedAdmin();

  let publishedCount = 0;
  let unchangedCount = 0;
  let sceneCount = 0;
  let quizCount = 0;

  for (const module of content.modules) {
    const m = module.manifest;
    await prisma.module.upsert({
      where: { id: m.id },
      update: {
        slug: m.slug,
        code: m.code,
        order: m.order,
        title: loc(m.title),
        description: loc(m.description),
        icon: m.icon,
        color: m.color,
      },
      create: {
        id: m.id,
        slug: m.slug,
        code: m.code,
        order: m.order,
        title: loc(m.title),
        description: loc(m.description),
        icon: m.icon,
        color: m.color,
      },
    });

    for (const lesson of module.lessons) {
      const meta = lesson.doc.meta;
      await prisma.lesson.upsert({
        where: { id: meta.id },
        update: { slug: meta.slug, moduleId: m.id, order: meta.order },
        create: { id: meta.id, slug: meta.slug, moduleId: m.id, order: meta.order },
      });

      // Sahneler (dersten önce, blok referansları için)
      for (const s of lesson.scenes) {
        const existing = await prisma.animationScene.findUnique({ where: { id: s.scene.id } });
        const changed = !existing || hash(existing.data) !== hash(s.scene);
        await prisma.animationScene.upsert({
          where: { id: s.scene.id },
          update: changed
            ? {
                data: json(s.scene),
                title: loc(s.scene.title),
                lessonId: meta.id,
                sourceFile: s.file,
                version: (existing?.version ?? 0) + 1,
                status: 'published',
                authorId: adminId,
              }
            : { lessonId: meta.id, sourceFile: s.file },
          create: {
            id: s.scene.id,
            data: json(s.scene),
            title: loc(s.scene.title),
            lessonId: meta.id,
            sourceFile: s.file,
            version: 1,
            status: 'published',
            authorId: adminId,
          },
        });
        sceneCount += 1;
      }

      // Quiz
      if (lesson.quiz) {
        const q = lesson.quiz;
        await prisma.quiz.upsert({
          where: { id: q.id },
          update: {
            lessonId: meta.id,
            title: loc(q.title),
            passScore: q.passScore,
            status: 'published',
          },
          create: {
            id: q.id,
            lessonId: meta.id,
            title: loc(q.title),
            passScore: q.passScore,
            status: 'published',
          },
        });
        // Dosyadan çıkan sorular arşivlenir (silinirse deneme ve tekrar geçmişi de silinirdi)
        await prisma.question.updateMany({
          where: { quizId: q.id, key: { notIn: q.questions.map((x) => x.id) } },
          data: { archived: true },
        });
        for (const [i, question] of q.questions.entries()) {
          const data = {
            archived: false,
            order: i,
            type: question.type,
            prompt: loc(question.prompt),
            options: json(question.options),
            correct: question.correct,
            explanation: loc(question.explanation),
            difficulty: question.difficulty,
            concepts: question.concepts,
          };
          await prisma.question.upsert({
            where: { quizId_key: { quizId: q.id, key: question.id } },
            update: data,
            create: { ...data, quizId: q.id, key: question.id },
          });
        }
        quizCount += 1;
      }

      // Ders sürümü
      const blocks = resolveBlocks(lesson);
      const versionPayload = {
        title: loc(meta.title),
        summary: loc(meta.summary),
        durationMinutes: meta.durationMinutes,
        level: meta.level,
        tags: meta.tags,
        prerequisites: meta.prerequisites,
        concepts: meta.concepts,
        blocks: json(blocks),
      };
      const current = await prisma.lesson.findUnique({
        where: { id: meta.id },
        include: { publishedVersion: true },
      });
      const published = current?.publishedVersion;
      const fingerprint = versionFingerprint(versionPayload);
      const existingFingerprint = published ? versionFingerprint(published) : null;

      if (published && existingFingerprint === fingerprint && meta.status === 'published') {
        unchangedCount += 1;
        continue;
      }
      // Taslak dersler: son taslak aynı içerikteyse her seed'de yeni taslak sürümü üretme
      if (meta.status !== 'published') {
        const latestDraft = await prisma.lessonVersion.findFirst({
          where: { lessonId: meta.id, status: 'draft' },
          orderBy: { version: 'desc' },
        });
        if (latestDraft && versionFingerprint(latestDraft) === fingerprint) {
          unchangedCount += 1;
          continue;
        }
      }

      const last = await prisma.lessonVersion.findFirst({
        where: { lessonId: meta.id },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (last?.version ?? 0) + 1;
      const titleText =
        typeof meta.title === 'string' ? meta.title : `${meta.title.tr} ${meta.title.en ?? ''}`;
      const summaryText =
        typeof meta.summary === 'string'
          ? meta.summary
          : `${meta.summary.tr} ${meta.summary.en ?? ''}`;
      const searchText =
        `${titleText}\n${summaryText}\n${meta.concepts.join(' ')} ${meta.tags.join(' ')}\n${lessonPlainText(lesson.doc)}`.slice(
          0,
          200_000,
        );

      await prisma.$transaction(async (tx) => {
        if (meta.status === 'published') {
          await tx.lessonVersion.updateMany({
            where: { lessonId: meta.id, status: 'published' },
            data: { status: 'archived' },
          });
        }
        const version = await tx.lessonVersion.create({
          data: {
            ...versionPayload,
            lessonId: meta.id,
            version: nextVersion,
            status: meta.status === 'published' ? 'published' : 'draft',
            publishedAt: meta.status === 'published' ? new Date() : null,
            authorId: adminId,
          },
        });
        if (meta.status === 'published') {
          await tx.lesson.update({
            where: { id: meta.id },
            data: { publishedVersionId: version.id, searchText },
          });
        }
      });
      publishedCount += 1;
    }
  }

  // Öğrenme yolları (content/paths.json yoksa müfredattaki varsayılanlar)
  const paths = content.paths.length ? content.paths : LEARNING_PATHS;
  const existingLessonIds = new Set(
    (await prisma.lesson.findMany({ select: { id: true } })).map((l) => l.id),
  );
  const existingModuleIds = new Set(
    (await prisma.module.findMany({ select: { id: true } })).map((m) => m.id),
  );
  for (const [order, p] of paths.entries()) {
    await prisma.learningPath.upsert({
      where: { id: p.id },
      update: {
        slug: p.slug,
        title: loc(p.title),
        description: loc(p.description),
        icon: p.icon,
        order,
      },
      create: {
        id: p.id,
        slug: p.slug,
        title: loc(p.title),
        description: loc(p.description),
        icon: p.icon,
        order,
      },
    });
    await prisma.learningPathItem.deleteMany({ where: { pathId: p.id } });
    let itemOrder = 0;
    for (const item of p.items) {
      const [moduleId, lessonId] = item.split('/');
      if (!existingModuleIds.has(moduleId)) {
        console.warn(`  ⚠ yol ${p.id}: modül yok → ${moduleId}`);
        continue;
      }
      if (lessonId && !existingLessonIds.has(lessonId)) {
        console.warn(`  ⚠ yol ${p.id}: ders henüz yazılmamış → ${lessonId} (atlandı)`);
        continue;
      }
      await prisma.learningPathItem.create({
        data: { pathId: p.id, order: itemOrder++, moduleId, lessonId: lessonId ?? null },
      });
    }
  }
  console.log(`✓ ${paths.length} öğrenme yolu`);

  // Müfredatta olup içerikte olmayan dersler için kayıt (taslak, yayınsız) — admin panelinde görünür
  let placeholders = 0;
  for (const m of CURRICULUM) {
    if (!existingModuleIds.has(m.id)) continue;
    for (const l of m.lessons) {
      if (existingLessonIds.has(l.id)) continue;
      await prisma.lesson.create({
        data: { id: l.id, slug: l.slug, moduleId: m.id, order: l.order },
      });
      await prisma.lessonVersion.create({
        data: {
          lessonId: l.id,
          version: 1,
          status: 'draft',
          title: loc(l.title),
          summary: loc(l.summary),
          blocks: json([]),
          authorId: adminId,
        },
      });
      placeholders += 1;
    }
  }

  console.log(
    `✓ ${publishedCount} ders sürümü yazıldı, ${unchangedCount} değişmedi, ${placeholders} taslak yer tutucu`,
  );
  console.log(`✓ ${sceneCount} sahne, ${quizCount} quiz`);
  await clearApiCache();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
