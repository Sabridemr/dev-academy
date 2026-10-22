import { createHash } from 'node:crypto';
import { interactiveTraceSrc, type LessonBlock } from '@devacademy/shared';
import type { LoadedLesson } from '@devacademy/shared/node';

/**
 * content/ ↔ veritabanı eşitlemesinin saf parçaları. Seed (content/ → DB) ve dışa aktarım
 * (DB → content/) aynı dönüşümü ve aynı içerik özetini kullansın diye burada toplanır.
 */

/** jsonb anahtar sırasını değiştirir ve undefined alanları atar; karşılaştırma için kanonik biçim */
export function canonical(v: unknown): unknown {
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

export function hash(v: unknown): string {
  return createHash('sha1')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
}

export type VersionFields = {
  title: unknown;
  summary: unknown;
  durationMinutes: number;
  level: unknown;
  tags: string[];
  prerequisites: string[];
  concepts: string[];
  blocks: unknown;
};

/** Ders sürümünün içerik özeti (seed'in "değişti mi?" karşılaştırması ve LessonVersion.contentHash) */
export function versionFingerprint(v: VersionFields): string {
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

export type StoredAsset = { src: string; width: number; height: number };

/**
 * Ders bloklarını veritabanına yazılabilir hâle getirir: SVG'ler inline, raster görseller API yoluna
 * çevrilmiş (boyutlarıyla), sahne/quiz id'leri çözülmüş, kod izleri ve alıştırmalar (çözüm ayrı alanda)
 * gömülü
 */
export function resolveLessonBlocks(
  lesson: LoadedLesson,
  assets: Record<string, StoredAsset>,
): LessonBlock[] {
  return lesson.doc.blocks.map((b) => {
    switch (b.type) {
      case 'diagram':
        return assets[b.src] ? { ...b, ...assets[b.src] } : { ...b, svg: lesson.svgs[b.src] };
      case 'animation': {
        const scene = lesson.scenes.find((s) => s.file === b.scene);
        return { ...b, sceneId: scene?.scene.id };
      }
      case 'quiz':
        return { ...b, quizId: lesson.quiz?.id };
      case 'trace':
        return { ...b, trace: lesson.traces[b.src] };
      case 'exercise': {
        // Çözüm ayrı alanda: ders API'si bloklardan çıkarır, yalnızca çözüm uç noktası döner
        const ex = lesson.exercises[b.src];
        if (!ex) return b;
        const { solution, ...exercise } = ex;
        return { ...b, exercise, solution };
      }
      case 'interactive': {
        // İz kullanan simülatör (predict-run): :::trace ile aynı iz bloğa gömülür
        const src = interactiveTraceSrc(b);
        return src ? { ...b, trace: lesson.traces[src] } : b;
      }
      default:
        return b;
    }
  });
}

/* ------------------------- Seed: panel koruması ------------------------- */

export type ContentSource = 'seed' | 'admin';

export interface SeedDecisionInput {
  /** content/ dosyalarından üretilen sürümün özeti */
  contentFingerprint: string;
  /** Yayındaki sürüm (yoksa null) */
  published: { source: ContentSource; fingerprint: string } | null;
  /** Seed'in bu ders için en son yazdığı sürümün content/ özeti (hiç yazmadıysa null) */
  lastSeedContentHash: string | null;
  /** --force: panel değişikliğini de ez */
  force: boolean;
}

export type SeedDecision =
  /** Yayındaki sürüm content/ ile aynı: yazacak bir şey yok */
  | 'unchanged'
  /** content/'tan yeni sürüm yaz */
  | 'write'
  /** Yayındaki sürüm panelde oluşturulmuş ve content/ son seed'den beri değişmemiş: dokunma */
  | 'skip-admin'
  /** Yayındaki sürüm panelden ama content/ de değişmiş (ya da --force): content/ kazanır */
  | 'overwrite-admin';

/**
 * Seed'in bir ders için ne yapacağına karar verir. Panelde yayınlanan bir sürümü, content/ dosyası
 * son seed'den beri değişmediyse korur; böylece `db:seed` panel düzenlemesini sessizce ezmez.
 */
export function decideSeedAction(input: SeedDecisionInput): SeedDecision {
  const { contentFingerprint, published, lastSeedContentHash, force } = input;
  if (published && published.fingerprint === contentFingerprint) return 'unchanged';
  if (!published || published.source !== 'admin') return 'write';
  if (force) return 'overwrite-admin';
  // Seed bu dersi hiç yazmadıysa (ders panelde oluşturulmuş) ya da dosya o zamandan beri aynıysa koru
  if (lastSeedContentHash === null || lastSeedContentHash === contentFingerprint)
    return 'skip-admin';
  return 'overwrite-admin';
}
