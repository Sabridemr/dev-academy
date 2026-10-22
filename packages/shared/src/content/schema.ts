import { z } from 'zod';
import { LocalizedStringSchema } from '../i18n';
import { CodeTraceSchema } from './trace';

/**
 * İÇERİK ŞEMASI
 * -------------
 * content/ klasöründeki Markdown + JSON dosyaları bu şemalarla doğrulanır,
 * backend seed'i de aynı tipleri veritabanına yazar.
 */

export const LessonLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type LessonLevel = z.infer<typeof LessonLevelSchema>;

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** lesson.md frontmatter */
export const LessonFrontmatterSchema = z
  .object({
    id: z.string().regex(SLUG_REGEX, 'id kebab-case olmalı'),
    slug: z.string().regex(SLUG_REGEX, 'slug kebab-case olmalı'),
    module: z.string().regex(SLUG_REGEX),
    order: z.number().int().min(1),
    title: LocalizedStringSchema,
    summary: LocalizedStringSchema,
    durationMinutes: z.number().int().min(1).max(240).default(15),
    level: LessonLevelSchema.default('beginner'),
    tags: z.array(z.string()).default([]),
    /** Ön koşul ders id'leri */
    prerequisites: z.array(z.string()).default([]),
    /** Kavram anahtarları (arama + spaced repetition için) */
    concepts: z.array(z.string()).default([]),
    /** Yayın durumu: content/ içindeki her ders varsayılan olarak yayınlanır */
    status: z.enum(['draft', 'published']).default('published'),
  })
  .strict();
export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;

/* ----------------------------- Bloklar ----------------------------- */

const BaseBlock = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
});

export const TextBlockSchema = BaseBlock.extend({
  type: z.literal('text'),
  /** Markdown (tr) */
  markdown: z.string(),
  /** Markdown (en) — opsiyonel */
  markdownEn: z.string().optional(),
});

export const DiagramBlockSchema = BaseBlock.extend({
  type: z.literal('diagram'),
  /**
   * Ders klasörüne göre SVG ya da raster görsel (png, jpg, webp) yolu, ya da mutlak URL.
   * Seed raster görselleri veritabanına alır ve src'yi API yoluna (`/assets/<sha256>.<ext>`) çevirir.
   */
  src: z.string().min(1),
  alt: LocalizedStringSchema,
  caption: LocalizedStringSchema.optional(),
  /** Inline SVG içeriği (seed sırasında doldurulur) */
  svg: z.string().optional(),
  /** Raster görselin piksel boyutu (seed doldurur; istemci en-boy oranını önceden ayırır) */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const AnimationBlockSchema = BaseBlock.extend({
  type: z.literal('animation'),
  /** Ders klasörüne göre sahne JSON yolu */
  scene: z.string().min(1),
  /** Seed sonrası sahne id'si */
  sceneId: z.string().optional(),
  caption: LocalizedStringSchema.optional(),
});

/** Web ve mobilde ayrı bileşen olarak var olan interaktif simülatörler */
export const InteractiveTypeSchema = z.enum([
  'load-balancer',
  'cache',
  'rate-limiter',
  'consistent-hashing',
  'gradient-descent',
  'attention',
  'neural-network-playground',
  'capacity-estimator',
  'er-diagram',
  'cap-theorem',
  'scaling',
  'message-queue',
  'replication-quorum',
  'index-query-plan',
  'isolation-levels',
  'k-means',
  'decision-tree',
  'convolution',
  'tokenizer',
  'embedding-space',
  'pipeline',
  'kubernetes-hpa',
  'request-journey',
  'traffic-wave',
  'fan-out',
  'geo-index',
  'sorting-visualizer',
  'graph-traversal',
  'hash-table',
  'big-o-plotter',
  'rag-pipeline',
  'prompt-playground',
  'token-cost',
  'oauth-flow',
  'jwt-inspector',
  'bruteforce-login',
  'git-graph',
  'python-memory',
  'predict-run',
]);
export type InteractiveType = z.infer<typeof InteractiveTypeSchema>;

/**
 * Her interaktif türün ders Markdown'ında kabul ettiği parametreler (`:::interactive{type=... key=value}`).
 * İçerik doğrulayıcısı bilinmeyen parametreyi hata sayar: simülatörün okumadığı bir parametre sessizce
 * yok sayılır ve dersteki yönerge gerçek kontrollerle uyuşmaz. Web simülatörlerinin bu anahtarları
 * gerçekten okuduğu web birim testinde (simulators/params.test.ts) kontrol edilir.
 */
export const INTERACTIVE_PARAMS = {
  'load-balancer': ['algorithm', 'servers', 'sticky'],
  cache: ['capacity', 'policy', 'writePolicy', 'ttlMs', 'ttlSec'],
  'rate-limiter': ['algorithm', 'capacity', 'limit', 'rate', 'refillPerSec', 'refillPerSecond', 'windowMs'],
  'consistent-hashing': ['keys', 'nodes', 'virtualNodes'],
  'gradient-descent': ['b', 'learningRate', 'optimizer', 'startX', 'surface', 'w'],
  attention: ['causal', 'heads', 'sentence', 'temperature'],
  'neural-network-playground': ['activation', 'dataset', 'hiddenLayers', 'learningRate', 'noise'],
  'capacity-estimator': ['avgReadSizeBytes', 'avgWriteSizeBytes', 'dau', 'hotDataRatio', 'peakMultiplier', 'readsPerUserPerDay', 'replicationFactor', 'retentionYears', 'writesPerUserPerDay'],
  'er-diagram': ['preset', 'showCardinality', 'tables'],
  'cap-theorem': ['consistency', 'mode', 'nodes', 'partition', 'replicas'],
  scaling: ['autoscale', 'failureZone', 'instancesPerZone', 'maxServers', 'mode', 'serverCapacityRps', 'servers', 'trafficRps', 'zones'],
  'message-queue': ['consumers', 'failureRate', 'idempotent', 'maxRetries', 'partitions', 'producers'],
  'replication-quorum': ['failedNodes', 'latencyMs', 'nodes', 'readQuorum', 'regions', 'writeQuorum'],
  'index-query-plan': ['query', 'rows'],
  'isolation-levels': ['level', 'scenario'],
  'k-means': ['init', 'k'],
  'decision-tree': ['criterion', 'dataset', 'maxDepth', 'minSamplesLeaf'],
  convolution: ['kernel', 'padding', 'stride'],
  tokenizer: ['text'],
  'embedding-space': ['dimensions', 'showNeighbors'],
  pipeline: ['failureStage', 'retries', 'stages'],
  'kubernetes-hpa': ['cpuRequestMillicores', 'maxReplicas', 'minReplicas', 'stabilizationWindowSec', 'targetCpuPercent'],
  'request-journey': ['budgetMs', 'cacheHitRate', 'failureStage', 'http3', 'layers', 'path', 'rttMs', 'services', 'showColdStart', 'slowPenaltyMs', 'slowService', 'stages'],
  'traffic-wave': ['autoscale', 'baselineRps', 'peakMultiplier', 'queueEnabled', 'rampSeconds', 'scaleUpDelaySeconds'],
  'fan-out': ['avgFollowers', 'celebrities', 'celebrity', 'celebrityFollowers', 'celebrityThreshold', 'mode'],
  'geo-index': ['drivers', 'resolution', 'ringSize', 'showBoundaryProblem'],
  'sorting-visualizer': ['algorithm', 'size', 'speed'],
  'graph-traversal': ['algorithm', 'nodes', 'start', 'target', 'weighted'],
  'hash-table': ['buckets', 'collision', 'loadFactor'],
  'big-o-plotter': ['functions', 'maxN'],
  'rag-pipeline': ['chunkSize', 'overlap', 'query', 'topK'],
  'prompt-playground': ['preset', 'temperature'],
  'token-cost': ['inputTokens', 'model', 'outputTokens', 'requestsPerDay'],
  'oauth-flow': ['flow', 'pkce'],
  'jwt-inspector': ['secret', 'token'],
  'bruteforce-login': ['attemptsPerSecond', 'lockoutAfter', 'lockoutSeconds', 'passwordSpace'],
  'git-graph': ['scenario'],
  'python-memory': ['scenario'],
  'predict-run': ['src'],
} as const satisfies Record<InteractiveType, readonly string[]>;

/** Kod izini (`*.trace.json`) girdi olarak alan interaktif türler: iz, `src` parametresinden çözülür */
export const TRACE_INTERACTIVES: readonly InteractiveType[] = ['predict-run'];

/**
 * İz kullanan interaktif bloğun ders klasörüne göre iz dosya adı (`src` parametresi); iz kullanmayan
 * türlerde ya da parametre eksikse null. İçerik doğrulayıcısı ve seed aynı çözümlemeyi kullanır.
 */
export function interactiveTraceSrc(block: {
  interactive: InteractiveType;
  params?: Record<string, unknown>;
}): string | null {
  if (!TRACE_INTERACTIVES.includes(block.interactive)) return null;
  const src = block.params?.src;
  return typeof src === 'string' && src.length > 0 ? src : null;
}

/** Quiz soru sayısı kuralı (içerik yazım kılavuzu): en az 3, en fazla 6 */
export const QUIZ_QUESTION_RANGE = { min: 3, max: 6 } as const;

export const InteractiveBlockSchema = BaseBlock.extend({
  type: z.literal('interactive'),
  interactive: InteractiveTypeSchema,
  /** Simülatöre geçirilecek başlangıç parametreleri */
  params: z.record(z.unknown()).default({}),
  title: LocalizedStringSchema.optional(),
  instructions: LocalizedStringSchema.optional(),
  /** predict-run: `params.src` ile verilen ders klasöründeki kod izi (seed sırasında doldurulur) */
  trace: CodeTraceSchema.optional(),
});

export const CodeBlockSchema = BaseBlock.extend({
  type: z.literal('code'),
  language: z.string().min(1),
  title: LocalizedStringSchema.optional(),
  code: z.string(),
  /** Aynı örneğin farklı dillerdeki sürümleri (ör. tasarım kalıpları: ts/py/java) */
  alternatives: z
    .array(z.object({ language: z.string(), code: z.string(), title: LocalizedStringSchema.optional() }))
    .default([]),
  highlightLines: z.array(z.number().int()).default([]),
});

export const RealWorldBlockSchema = BaseBlock.extend({
  type: z.literal('realworld'),
  company: z.string().min(1),
  markdown: z.string(),
  markdownEn: z.string().optional(),
});

export const CalloutBlockSchema = BaseBlock.extend({
  type: z.literal('callout'),
  tone: z.enum(['info', 'tip', 'warning', 'danger']).default('info'),
  title: LocalizedStringSchema.optional(),
  markdown: z.string(),
  markdownEn: z.string().optional(),
});

export const QuizBlockSchema = BaseBlock.extend({
  type: z.literal('quiz'),
  /** Ders klasörüne göre quiz JSON yolu */
  src: z.string().min(1),
  quizId: z.string().optional(),
});

/** Satır satır kod izi (simülasyon): kod, çağrı yığını, heap ve çıktı adım adım oynatılır */
export const TraceBlockSchema = BaseBlock.extend({
  type: z.literal('trace'),
  /** Ders klasörüne göre iz JSON yolu (`<ad>.trace.json`, `<ad>.trace.py`'den üretilir) */
  src: z.string().min(1),
  title: LocalizedStringSchema.optional(),
  caption: LocalizedStringSchema.optional(),
  /** İz içeriği (seed sırasında doldurulur) */
  trace: CodeTraceSchema.optional(),
});

export const NextBlockSchema = BaseBlock.extend({
  type: z.literal('next'),
  lesson: z.string().min(1),
  note: LocalizedStringSchema.optional(),
});

export const LessonBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  DiagramBlockSchema,
  AnimationBlockSchema,
  InteractiveBlockSchema,
  CodeBlockSchema,
  RealWorldBlockSchema,
  CalloutBlockSchema,
  QuizBlockSchema,
  TraceBlockSchema,
  NextBlockSchema,
]);
export type LessonBlock = z.infer<typeof LessonBlockSchema>;
export type LessonBlockType = LessonBlock['type'];

export const LESSON_BLOCK_TYPES = [
  'text',
  'diagram',
  'animation',
  'interactive',
  'code',
  'realworld',
  'callout',
  'quiz',
  'trace',
  'next',
] as const satisfies readonly LessonBlockType[];

/* ------------------------------ Quiz ------------------------------- */

export const QuestionTypeSchema = z.enum(['single', 'multiple', 'truefalse', 'order']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuizOptionSchema = z
  .object({
    id: z.string().min(1),
    text: LocalizedStringSchema,
  })
  .strict();

export const QuizQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: QuestionTypeSchema.default('single'),
    prompt: LocalizedStringSchema,
    options: z.array(QuizOptionSchema).min(2),
    /** Doğru seçenek id'leri; 'order' tipinde doğru sıralama */
    correct: z.array(z.string()).min(1),
    /** Yanlış cevapta gösterilen açıklama */
    explanation: LocalizedStringSchema,
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    concepts: z.array(z.string()).default([]),
  })
  .strict()
  .superRefine((q, ctx) => {
    const optionIds = new Set(q.options.map((o) => o.id));
    for (const c of q.correct) {
      if (!optionIds.has(c)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Bilinmeyen doğru seçenek: ${c}`, path: ['correct'] });
      }
    }
    if (q.type === 'single' && q.correct.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'single tipinde tek doğru olmalı', path: ['correct'] });
    }
    if (q.type === 'truefalse' && q.options.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'truefalse tipinde iki seçenek olmalı', path: ['options'] });
    }
    if (q.type === 'order' && q.correct.length !== q.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'order tipinde tüm seçenekler sıralanmalı', path: ['correct'] });
    }
  });
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z
  .object({
    id: z.string().regex(SLUG_REGEX),
    title: LocalizedStringSchema,
    /** Geçme yüzdesi */
    passScore: z.number().min(0).max(100).default(70),
    questions: z.array(QuizQuestionSchema).min(1).max(20),
  })
  .strict();
export type Quiz = z.infer<typeof QuizSchema>;

/* ---------------------------- Ders dokümanı ------------------------ */

export const LessonDocumentSchema = z.object({
  meta: LessonFrontmatterSchema,
  blocks: z.array(LessonBlockSchema),
  /** Kaynak dosya yolu (göreli) — tanı amaçlı */
  sourcePath: z.string().optional(),
});
export type LessonDocument = z.infer<typeof LessonDocumentSchema>;

/* ----------------------------- Modül ------------------------------- */

/** Modüller sayfasındaki kategori (sırası listede gösterim sırasıdır) */
export const MODULE_GROUPS = ['system-design', 'software', 'infrastructure', 'ai', 'programming'] as const;
export const ModuleGroupSchema = z.enum(MODULE_GROUPS);
export type ModuleGroup = z.infer<typeof ModuleGroupSchema>;

export const ModuleManifestSchema = z
  .object({
    id: z.string().regex(SLUG_REGEX),
    slug: z.string().regex(SLUG_REGEX),
    code: z.string().min(1).max(3),
    order: z.number().int().min(1),
    title: LocalizedStringSchema,
    description: LocalizedStringSchema,
    icon: z.string().default('book'),
    color: z.string().default('#6366f1'),
    group: ModuleGroupSchema.default('system-design'),
  })
  .strict();
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

export const LearningPathManifestSchema = z
  .object({
    id: z.string().regex(SLUG_REGEX),
    slug: z.string().regex(SLUG_REGEX),
    title: LocalizedStringSchema,
    description: LocalizedStringSchema,
    icon: z.string().default('route'),
    /** Sıralı modül id'leri; belirli dersler için "module/lesson" formatı da kabul edilir */
    items: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type LearningPathManifest = z.infer<typeof LearningPathManifestSchema>;
