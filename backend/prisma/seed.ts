/**
 * SEED
 * ----
 * content/ klasöründeki müfredatı (modüller, dersler, sahneler, quizler, öğrenme yolları, kavram sözlüğü) ve
 * rozet tanımlarını veritabanına yükler. İdempotenttir: tekrar çalıştırıldığında mevcut kayıtları günceller,
 * yayındaki ders sürümünü yalnızca içerik değiştiyse yeni sürüm olarak yayınlar.
 *
 * Panel koruması: yayındaki sürüm admin panelinde oluşturulmuşsa (LessonVersion.source = admin) ve
 * dersin content/ dosyaları seed'in son yazdığından beri değişmediyse (LessonVersion.contentHash) ders
 * atlanır ve uyarı yazılır; panel değişikliği önce `pnpm content:export` ile content/'a alınmalıdır.
 * `--force` (ya da SEED_FORCE=1) ile panel sürümü content/ sürümüyle ezilir.
 *
 * Çalıştır: pnpm db:seed [--strict] [--force]   (CONTENT_DIR ile klasör değiştirilebilir)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import {
  BADGES,
  buildSearchText,
  CONTENT_ASSET_PREFIX,
  CURRICULUM,
  RASTER_IMAGE_TYPES,
  rasterExtension,
  type LocalizedString,
} from '@devacademy/shared';
import {
  coverageReport,
  loadContent,
  type LoadedContent,
  type LoadedLesson,
} from '@devacademy/shared/node';
import {
  decideSeedAction,
  hash,
  resolveLessonBlocks,
  versionFingerprint,
  type StoredAsset,
} from '../src/modules/admin/content-sync';

const prisma = new PrismaClient();

function loc(v: LocalizedString): Prisma.InputJsonValue {
  return typeof v === 'string' ? v : { tr: v.tr, ...(v.en ? { en: v.en } : {}) };
}
function json(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}
let assetCount = 0;

/**
 * Dersin raster görsellerini (png/jpg/webp) veritabanına yazar. Kimlik içeriğin SHA-256'sıdır: aynı
 * dosya bir kez saklanır, değişmeyen görsel yeniden yazılmaz ve adresi (`/assets/<sha>.<ext>`) sabit kalır.
 */
async function storeLessonAssets(lesson: LoadedLesson): Promise<Record<string, StoredAsset>> {
  const out: Record<string, StoredAsset> = {};
  for (const [file, img] of Object.entries(lesson.images)) {
    const ext = rasterExtension(file);
    if (!ext) continue;
    const bytes = readFileSync(img.path);
    const id = createHash('sha256').update(bytes).digest('hex');
    const exists = await prisma.contentAsset.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      await prisma.contentAsset.create({
        data: {
          id,
          mime: RASTER_IMAGE_TYPES[ext],
          bytes,
          width: img.width,
          height: img.height,
          size: bytes.length,
        },
      });
      assetCount += 1;
    }
    const canonicalExt = ext === 'jpeg' ? 'jpg' : ext;
    out[file] = {
      src: `${CONTENT_ASSET_PREFIX}${id}.${canonicalExt}`,
      width: img.width,
      height: img.height,
    };
  }
  return out;
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

/**
 * Kavram sözlüğünü (content/concepts.json) yükler. İdempotent: her kavram upsert edilir,
 * sözlükten çıkarılan kavramlar silinir (kavramlara yabancı anahtarla bağlı kayıt yoktur).
 */
async function seedConcepts(glossary: LoadedContent['glossary']): Promise<void> {
  if (!glossary) {
    console.warn('⚠ Kavram sözlüğü yüklenemedi; Concept tablosu değiştirilmedi');
    return;
  }
  const entries = Object.entries(glossary);
  for (const [id, c] of entries) {
    const data = {
      term: json(c.term),
      definition: json(c.definition),
      aliases: c.aliases,
      related: c.related,
    };
    await prisma.concept.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  const removed = await prisma.concept.deleteMany({
    where: { id: { notIn: entries.map(([id]) => id) } },
  });
  console.log(
    `✓ ${entries.length} kavram${removed.count ? `, ${removed.count} eski kavram silindi` : ''}`,
  );
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
  let skippedAdminCount = 0;
  const force = process.argv.includes('--force') || process.env.SEED_FORCE === '1';
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
        group: m.group,
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
        group: m.group,
      },
    });

    for (const lesson of module.lessons) {
      const meta = lesson.doc.meta;

      // Ders sürümünün içeriği (karar için önce hesaplanır)
      const blocks = resolveLessonBlocks(lesson, await storeLessonAssets(lesson));
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
      const fingerprint = versionFingerprint(versionPayload);
      const current = await prisma.lesson.findUnique({
        where: { id: meta.id },
        include: { publishedVersion: true },
      });
      const published = current?.publishedVersion;

      // Panel koruması: yayındaki sürüm panelden geldiyse ve content/ son seed'den beri değişmediyse
      // dersin hiçbir parçasına (ders kaydı, sahneler, quiz, sürüm) dokunma
      if (meta.status === 'published' && published?.source === 'admin') {
        // content/ ile en son eşitlenen sürümün özeti (seed yazdı ya da dışa aktarım sonrası aynı bulundu);
        // migration öncesi sürümlerde özet yok: son seed sürümünün kendi özeti kullanılır
        const synced = await prisma.lessonVersion.findFirst({
          where: { lessonId: meta.id, contentHash: { not: null } },
          orderBy: { version: 'desc' },
        });
        const lastSeed = synced
          ? null
          : await prisma.lessonVersion.findFirst({
              where: { lessonId: meta.id, source: 'seed' },
              orderBy: { version: 'desc' },
            });
        const decision = decideSeedAction({
          contentFingerprint: fingerprint,
          published: { source: published.source, fingerprint: versionFingerprint(published) },
          lastSeedContentHash:
            synced?.contentHash ?? (lastSeed ? versionFingerprint(lastSeed) : null),
          force,
        });
        if (decision === 'skip-admin') {
          console.warn(
            `  ⚠ ${meta.id}: yayındaki v${published.version} admin panelinden ve content/ değişmemiş; atlandı ` +
              `(panel değişikliğini content/'a almak için: pnpm content:export --lesson ${meta.id}; ezmek için --force)`,
          );
          skippedAdminCount += 1;
          continue;
        }
        if (decision === 'overwrite-admin') {
          console.warn(
            `  ⚠ ${meta.id}: yayındaki v${published.version} admin panelinden geliyordu; ${force ? '--force ile' : 'content/ değiştiği için'} content/ sürümü yayınlanıyor`,
          );
        }
      }

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

      const searchText = buildSearchText(
        lesson.doc.blocks,
        meta.title,
        meta.summary,
        meta.concepts,
        meta.tags,
      );

      if (
        published &&
        versionFingerprint(published) === fingerprint &&
        meta.status === 'published'
      ) {
        // İçerik aynı ama arama metninin biçimi değişmiş olabilir (buildSearchText güncellemesi)
        if (current?.searchText !== searchText) {
          await prisma.lesson.update({ where: { id: meta.id }, data: { searchText } });
        }
        // Panel sürümü content/'a aktarılmış (dışa aktarım): eşitlendiğini kaydet ki sonraki panel
        // düzenlemesi "content/ değişti" sanılıp ezilmesin
        if (published.source === 'admin' && published.contentHash !== fingerprint) {
          await prisma.lessonVersion.update({
            where: { id: published.id },
            data: { contentHash: fingerprint },
          });
        }
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
            source: 'seed',
            contentHash: fingerprint,
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

  // Öğrenme yolları: content/paths.json tek kaynaktır (müfredattaki eski kopya kaldırıldı)
  if (!content.paths.length) throw new Error('content/paths.json bulunamadı ya da boş');
  const paths = content.paths;
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
          source: 'seed',
        },
      });
      placeholders += 1;
    }
  }

  console.log(
    `✓ ${publishedCount} ders sürümü yazıldı, ${unchangedCount} değişmedi, ${skippedAdminCount} panel düzenlemesi korundu, ${placeholders} taslak yer tutucu`,
  );
  console.log(`✓ ${sceneCount} sahne, ${quizCount} quiz, ${assetCount} yeni görsel`);
  await seedConcepts(content.glossary);
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
