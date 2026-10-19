import { z } from 'zod';
import { LocalizedStringSchema } from '../i18n';

/**
 * KOD İZİ (code trace)
 * --------------------
 * Bir programın satır satır çalışmasının kaydı: her adımda çalışan satır, çağrı yığını (çerçeveler ve
 * yerel değişkenler), bellekteki (heap) nesneler ve o ana kadarki çıktı. Python örnekleri gerçekten
 * çalıştırılarak üretilir (`pnpm content:traces`, scripts/python-trace/tracer.py → `*.trace.json`);
 * istemciler yalnızca bu kaydı oynatır, kod çalıştırmaz.
 */

/** Değişkenin ya da bir nesne alanının değeri: heap nesnesine referans ya da satır içi basit değer */
export const TraceValueSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ref'), id: z.number().int().min(1) }).strict(),
  z
    .object({
      t: z.literal('prim'),
      /** Python tür adı: int, float, str, bool, NoneType … */
      type: z.string().min(1),
      repr: z.string(),
    })
    .strict(),
]);
export type TraceValue = z.infer<typeof TraceValueSchema>;

export const TraceHeapObjectSchema = z
  .object({
    /** İz boyunca sabit kimlik (Python id()'sinin sıralı karşılığı) */
    id: z.number().int().min(1),
    kind: z.enum(['list', 'tuple', 'set', 'dict', 'instance', 'class', 'function', 'prim', 'other']),
    /** Python tür adı (list, dict, Dog, function …) */
    type: z.string().min(1),
    /** prim / other / function için okunur gösterim (ör. "42", "'merhaba'", "kare(x)") */
    repr: z.string().optional(),
    /** list / tuple / set elemanları */
    items: z.array(TraceValueSchema).optional(),
    /** dict anahtar-değer çiftleri */
    entries: z.array(z.tuple([TraceValueSchema, TraceValueSchema])).optional(),
    /** instance / class alanları, function için closure değişkenleri */
    attrs: z.array(z.tuple([z.string(), TraceValueSchema])).optional(),
  })
  .strict();
export type TraceHeapObject = z.infer<typeof TraceHeapObjectSchema>;

export const TraceFrameSchema = z
  .object({
    /** Çerçevenin iz boyunca sabit kimliği (aynı fonksiyonun iki çağrısı farklı çerçevedir) */
    id: z.number().int().min(0),
    /** "Global" ya da fonksiyon adı */
    name: z.string().min(1),
    line: z.number().int().min(1),
    locals: z.array(z.tuple([z.string(), TraceValueSchema])),
  })
  .strict();
export type TraceFrame = z.infer<typeof TraceFrameSchema>;

export const TraceStepSchema = z
  .object({
    /** Sıradaki çalışacak satır (1 tabanlı) */
    line: z.number().int().min(1),
    event: z.enum(['line', 'call', 'return', 'exception', 'end']),
    /** Global çerçeve ilk, en derin (çalışan) çerçeve son */
    frames: z.array(TraceFrameSchema).min(1),
    /** Çerçevelerden erişilebilen nesneler, ilk görülme sırasıyla */
    heap: z.array(TraceHeapObjectSchema),
    /** Programın o ana kadarki toplam çıktısı */
    stdout: z.string(),
    /** event = return: dönen değer */
    returnValue: TraceValueSchema.optional(),
    /** event = exception / end (yakalanmamış hata): "ZeroDivisionError: division by zero" */
    exception: z.string().optional(),
    /** Bu adımda gösterilen açıklama (koddaki `#@ tr | en` yorumundan) */
    note: LocalizedStringSchema.optional(),
  })
  .strict();
export type TraceStep = z.infer<typeof TraceStepSchema>;

/** Bir izdeki en fazla adım: daha uzun örnek, okuru yorar ve ders JSON'unu şişirir */
export const MAX_TRACE_STEPS = 300;

export const CodeTraceSchema = z
  .object({
    version: z.literal(1),
    language: z.literal('python'),
    /** Gösterilen kod (`#@` açıklama yorumları ve `#!` ayar satırları çıkarılmış) */
    code: z.string().min(1),
    /** Kaynak .trace.py dosyasının sha256'sı: iz güncel mi kontrolü */
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    pythonVersion: z.string().min(1),
    steps: z.array(TraceStepSchema).min(1).max(MAX_TRACE_STEPS),
  })
  .strict()
  .superRefine((trace, ctx) => {
    const lineCount = trace.code.split('\n').length;
    trace.steps.forEach((step, i) => {
      if (step.line > lineCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Adım ${i}: satır ${step.line} kodda yok`, path: ['steps', i, 'line'] });
      }
      const ids = new Set(step.heap.map((o) => o.id));
      const check = (v: TraceValue | undefined, where: string) => {
        if (v?.t === 'ref' && !ids.has(v.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Adım ${i}: ${where} heap'te olmayan #${v.id} nesnesine işaret ediyor`, path: ['steps', i] });
        }
      };
      for (const f of step.frames) for (const [name, v] of f.locals) check(v, `${f.name}.${name}`);
      for (const o of step.heap) {
        o.items?.forEach((v) => check(v, `#${o.id}`));
        o.entries?.forEach(([k, v]) => {
          check(k, `#${o.id}`);
          check(v, `#${o.id}`);
        });
        o.attrs?.forEach(([, v]) => check(v, `#${o.id}`));
      }
      check(step.returnValue, 'returnValue');
    });
  });
export type CodeTrace = z.infer<typeof CodeTraceSchema>;

/* --------------------------- Oynatıcı yardımcıları --------------------------- */

/** Nesne kimliğine sabit renk tonu: referans ile nesne, ok çizilemeyen dar ekranda renkten eşleşir */
export function traceHue(id: number): number {
  return (id * 137) % 360;
}

/** Bu adımda yeni oluşan ya da içeriği değişen heap nesneleri */
export function changedTraceObjects(prev: TraceStep | undefined, cur: TraceStep): Set<number> {
  const before = new Map((prev?.heap ?? []).map((o) => [o.id, JSON.stringify(o)]));
  const out = new Set<number>();
  if (!prev) return out;
  for (const o of cur.heap) if (before.get(o.id) !== JSON.stringify(o)) out.add(o.id);
  return out;
}

/** Bu adımda yeni tanımlanan ya da başka değere bağlanan değişkenler (`<çerçeve id>:<ad>`) */
export function changedTraceVars(prev: TraceStep | undefined, cur: TraceStep): Set<string> {
  const out = new Set<string>();
  if (!prev) return out;
  const before = new Map<string, string>();
  for (const f of prev.frames) for (const [name, v] of f.locals) before.set(`${f.id}:${name}`, JSON.stringify(v));
  for (const f of cur.frames)
    for (const [name, v] of f.locals) {
      const key = `${f.id}:${name}`;
      if (before.get(key) !== JSON.stringify(v)) out.add(key);
    }
  return out;
}

/** Az önce çalışmış satır (aynı çerçevede bir önceki adımın satırı): kodda soluk işaretlenir */
export function previousTraceLine(steps: TraceStep[], index: number): number | null {
  const cur = steps[index];
  const prev = steps[index - 1];
  if (!cur || !prev || prev.event === 'call') return null;
  const curTop = cur.frames[cur.frames.length - 1];
  const prevTop = prev.frames[prev.frames.length - 1];
  return curTop.id === prevTop.id && prev.line !== cur.line ? prev.line : null;
}
