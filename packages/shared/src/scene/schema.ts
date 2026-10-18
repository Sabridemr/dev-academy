import { z } from 'zod';
import { LocalizedStringSchema } from '../i18n';

/**
 * ANİMASYON SAHNESİ ŞEMASI
 * ------------------------
 * Bir "sahne" (scene) platformdan bağımsız bir animasyon senaryosudur.
 * Web (SVG + Framer Motion) ve mobil (react-native-svg + Reanimated) aynı JSON'u
 * kendi motoruyla oynatır. Sahne üç parçadan oluşur:
 *   - nodes: tuval üzerinde konumlanmış bileşenler (sunucu, DB, cache ...)
 *   - edges: düğümler arası bağlantılar
 *   - steps: adım adım anlatım; her adımda vurgulanan öğeler, düğüm durumları,
 *            kenarlar üzerinde hareket eden "paketler" ve açıklama metni.
 *
 * Koordinat sistemi: canvas.width x canvas.height mantıksal birim (varsayılan 1000x600).
 * Oynatıcılar viewBox ile ölçekler; böylece ekran boyutuna göre yeniden akar.
 */

export const SCENE_SCHEMA_VERSION = 1 as const;

export const NodeKindSchema = z.enum([
  'user',
  'client',
  'browser',
  'mobile',
  'server',
  'service',
  'lb',
  'gateway',
  'proxy',
  'cache',
  'db',
  'replica',
  'queue',
  'cdn',
  'dns',
  'storage',
  'region',
  'zone',
  'worker',
  'pod',
  'container',
  'function',
  'model',
  'neuron',
  'shard',
  'group',
  'generic',
]);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const NodeStatusSchema = z.enum([
  'idle',
  'active',
  'busy',
  'success',
  'warning',
  'error',
  'down',
  'muted',
]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const SceneNodeSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Düğüm kimliği yalnızca harf, rakam, _ ve - içerebilir'),
    kind: NodeKindSchema.default('generic'),
    label: LocalizedStringSchema,
    /** Mantıksal x konumu (düğümün merkezi) */
    x: z.number(),
    /** Mantıksal y konumu (düğümün merkezi) */
    y: z.number(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    /** Gruplama: bir "group" türündeki başka düğümün içinde çizilir */
    parent: z.string().optional(),
    /** Tema paletinden renk anahtarı (ör. "primary", "accent") ya da hex */
    color: z.string().optional(),
    /** Düğümün altında küçük açıklama satırı */
    sublabel: LocalizedStringSchema.optional(),
    /** Başlangıç durumu */
    status: NodeStatusSchema.default('idle'),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();
export type SceneNode = z.infer<typeof SceneNodeSchema>;

export const EdgeKindSchema = z.enum([
  'request',
  'response',
  'data',
  'event',
  'control',
  'replication',
  'generic',
]);
export const EdgeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export const SceneEdgeSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9_-]+$/),
    from: z.string().min(1),
    to: z.string().min(1),
    label: LocalizedStringSchema.optional(),
    kind: EdgeKindSchema.default('generic'),
    style: EdgeStyleSchema.default('solid'),
    bidirectional: z.boolean().default(false),
    /** -1..1 arası eğrilik; 0 düz çizgi */
    curvature: z.number().min(-1).max(1).default(0),
  })
  .strict();
export type SceneEdge = z.infer<typeof SceneEdgeSchema>;

export const PacketShapeSchema = z.enum(['dot', 'envelope', 'square', 'diamond']);

/** Bir adımda kenar boyunca hareket eden paket (istek, mesaj, veri parçası ...) */
export const ScenePacketSchema = z
  .object({
    id: z.string().optional(),
    edge: z.string().min(1),
    direction: z.enum(['forward', 'backward']).default('forward'),
    label: LocalizedStringSchema.optional(),
    color: z.string().optional(),
    shape: PacketShapeSchema.default('dot'),
    /** Adım başlangıcına göre ms cinsinden gecikme */
    startAt: z.number().min(0).default(0),
    durationMs: z.number().positive().default(900),
    /** Aynı paketi n kez tekrarla (ör. yoğun trafik) */
    repeat: z.number().int().min(1).max(50).default(1),
    /** Tekrarlar arası ms */
    repeatGapMs: z.number().min(0).default(250),
  })
  .strict();
export type ScenePacket = z.infer<typeof ScenePacketSchema>;

export const NodeStateSchema = z
  .object({
    status: NodeStatusSchema.optional(),
    /** Düğüm üzerinde küçük rozet (ör. "x3", "HIT", "503") */
    badge: z.string().optional(),
    /** Geçici etiket değişikliği */
    label: LocalizedStringSchema.optional(),
    sublabel: LocalizedStringSchema.optional(),
    /** Sayaç (istek sayısı vb.) */
    counter: z.number().optional(),
    /** 0..1 arası doluluk (CPU, kuyruk vs.) */
    progress: z.number().min(0).max(1).optional(),
    /** Düğümü görünmez yap/göster (ör. yeni replika ekleniyor) */
    visible: z.boolean().optional(),
  })
  .strict();
export type NodeState = z.infer<typeof NodeStateSchema>;

export const EdgeStateSchema = z
  .object({
    status: z.enum(['idle', 'active', 'error', 'muted']).optional(),
    label: LocalizedStringSchema.optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type EdgeState = z.infer<typeof EdgeStateSchema>;

export const SceneAnnotationSchema = z
  .object({
    id: z.string().min(1),
    x: z.number(),
    y: z.number(),
    text: LocalizedStringSchema,
    /** Oka hedef düğüm */
    target: z.string().optional(),
    tone: z.enum(['info', 'success', 'warning', 'danger']).default('info'),
  })
  .strict();
export type SceneAnnotation = z.infer<typeof SceneAnnotationSchema>;

export const SceneStepSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9_-]+$/),
    title: LocalizedStringSchema,
    /** Adım anlatımı (markdown destekli kısa metin) */
    narration: LocalizedStringSchema,
    /** Adımın otomatik oynatmada süresi */
    durationMs: z.number().positive().default(2500),
    /** Önceki adımın düğüm/kenar durumlarını devral (varsayılan: evet) */
    inherit: z.boolean().default(true),
    highlight: z
      .object({
        nodes: z.array(z.string()).default([]),
        edges: z.array(z.string()).default([]),
      })
      .strict()
      .default({ nodes: [], edges: [] }),
    nodeStates: z.record(NodeStateSchema).default({}),
    edgeStates: z.record(EdgeStateSchema).default({}),
    packets: z.array(ScenePacketSchema).default([]),
    annotations: z.array(SceneAnnotationSchema).default([]),
    /** Kamera: bir alana yakınlaştırma (viewBox ile) */
    camera: z
      .object({ x: z.number(), y: z.number(), zoom: z.number().positive() })
      .strict()
      .optional(),
  })
  .strict();
export type SceneStep = z.infer<typeof SceneStepSchema>;

export const SceneThemeSchema = z
  .object({
    /** Tema paletine ek anahtar → renk eşlemesi (açık tema) */
    light: z.record(z.string()).optional(),
    /** Koyu tema için */
    dark: z.record(z.string()).optional(),
  })
  .strict();

export const AnimationSceneSchema = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.literal(SCENE_SCHEMA_VERSION).default(SCENE_SCHEMA_VERSION),
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Sahne kimliği kebab-case olmalı'),
    title: LocalizedStringSchema,
    summary: LocalizedStringSchema.optional(),
    /** Erişilebilirlik: ekran okuyucular ve reduced-motion için metin alternatifi */
    a11y: z
      .object({
        description: LocalizedStringSchema,
        /** Adım adım metin transkripti (boşsa step.narration'lardan türetilir) */
        transcript: z.array(LocalizedStringSchema).optional(),
      })
      .strict(),
    canvas: z
      .object({
        width: z.number().positive().default(1000),
        height: z.number().positive().default(600),
      })
      .strict()
      .default({ width: 1000, height: 600 }),
    theme: SceneThemeSchema.optional(),
    nodes: z.array(SceneNodeSchema).min(1),
    edges: z.array(SceneEdgeSchema).default([]),
    steps: z.array(SceneStepSchema).min(1),
    loop: z.boolean().default(false),
    defaultSpeed: z.number().positive().default(1),
    tags: z.array(z.string()).default([]),
  })
  .strict();

export type AnimationScene = z.infer<typeof AnimationSceneSchema>;
/** Henüz parse edilmemiş (varsayılanlar uygulanmamış) sahne girdisi */
export type AnimationSceneInput = z.input<typeof AnimationSceneSchema>;
