import matter from 'gray-matter';
import { z } from 'zod';
import {
  InteractiveTypeSchema,
  LessonFrontmatterSchema,
  RESOURCE_KINDS,
  type ResourceKind,
  type LessonBlock,
  type LessonDocument,
} from './schema';
import type { LocalizedString } from '../i18n';

/**
 * DERS MARKDOWN AYRIŞTIRICISI
 * ---------------------------
 * Bir `lesson.md` dosyası YAML frontmatter + Markdown gövdesinden oluşur.
 * Gövde, özel "directive" blokları ile zengin bloklara ayrılır:
 *
 *   :::diagram{src="diagram.svg" alt="Yük dengeleyici"}
 *   İsteğe bağlı başlık/alt yazı metni
 *   :::
 *
 *   :::animation{scene="scene.json"}
 *   :::
 *
 *   :::interactive{type="load-balancer" algorithm="round-robin" servers=3}
 *   Kullanıcıya yönerge (opsiyonel)
 *   :::
 *
 *   :::code{lang="ts" title="Round robin"}
 *   ```ts
 *   const next = servers[i++ % servers.length];
 *   ```
 *   :::
 *
 *   :::realworld{company="Amazon"}
 *   Markdown
 *   :::
 *
 *   :::callout{tone="tip" title="İpucu"}
 *   Markdown
 *   :::
 *
 *   :::quiz{src="quiz.json"}
 *   :::
 *
 *   :::trace{src="degiskenler.trace.json" title="Etiketler ve nesneler"}
 *   İsteğe bağlı alt yazı
 *   :::
 *
 *   :::exercise{src="toplam.exercise.json"}
 *   İsteğe bağlı yönerge
 *   :::
 *
 *   :::next{lesson="a-02-latency-throughput"}
 *   :::
 *
 *   :::predict{id="lb-yeni-sunucu"}
 *   Soru metni | İsteğe bağlı İngilizce
 *   - [ ] Seçenek A | Option A
 *   - [x] Doğru seçenek B | Option B
 *   Açıklama: Neden B | Why B
 *   :::
 *
 *   :::resources
 *   - [Kitap adı](https://ornek.org) — kitap — İsteğe bağlı not
 *   :::
 *
 * Directive'ler arasında kalan Markdown "text" bloklarına dönüşür.
 */

const DIRECTIVE_OPEN = /^:::([a-z][a-z0-9-]*)(\{[^}]*\})?\s*$/;
const DIRECTIVE_CLOSE = /^:::\s*$/;

/** `{a="x" b=3 c=true d='y'}` biçimini nesneye çevirir */
export function parseDirectiveAttributes(raw: string | undefined): Record<string, string | number | boolean> {
  if (!raw) return {};
  const inner = raw.slice(1, -1).trim();
  const out: Record<string, string | number | boolean> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"']+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const key = m[1];
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    if (m[5] !== undefined) {
      if (value === 'true') out[key] = true;
      else if (value === 'false') out[key] = false;
      else if (/^-?\d+(\.\d+)?$/.test(value)) out[key] = Number(value);
      else out[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Markdown içindeki ilk ``` çitli kod bloğunu çıkarır */
export function extractFencedCode(body: string): { language?: string; code: string } | null {
  const m = /```([a-zA-Z0-9_+-]*)\s*\n([\s\S]*?)\n```/.exec(body);
  if (!m) return null;
  return { language: m[1] || undefined, code: m[2] };
}

/** "tr|en" formatında çift dilli kısa metin desteği (örn. alt="Yük dengeleyici|Load balancer") */
function toLocalized(value: unknown): LocalizedString | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value);
  if (s.includes('|')) {
    const [tr, en] = s.split('|').map((p) => p.trim());
    return { tr, en: en || undefined };
  }
  return s;
}

/** Türkçe/İngilizce ayırıcı: boşlukla çevrili dikey çizgi (`Türkçe | English`) */
const BILINGUAL_SEPARATOR = /\s\|\s/;

/** `Türkçe | English` metnini `{ tr, en? }` nesnesine çevirir (ayırıcı ilk ` | `) */
function toBilingual(value: string): { tr: string; en?: string } {
  const m = BILINGUAL_SEPARATOR.exec(value);
  if (!m) return { tr: value.trim() };
  const tr = value.slice(0, m.index).trim();
  const en = value.slice(m.index + m[0].length).trim();
  return en ? { tr, en } : { tr };
}

const PREDICT_OPTION = /^[-*]\s+\[([ xX])\]\s+(.+)$/;
const PREDICT_EXPLANATION = /^(?:Açıklama|Explanation)\s*:\s*(.*)$/i;

/** `:::predict` gövdesi: soru, `- [ ]`/`- [x]` seçenekleri, `Açıklama:` ile başlayan açıklama */
function parsePredictBody(body: string, sourcePath?: string, line?: number) {
  const lines = body.split(/\r?\n/);
  const promptLines: string[] = [];
  const explanationLines: string[] = [];
  const options: { id: string; text: { tr: string; en?: string }; correct: boolean }[] = [];
  let section: 'prompt' | 'options' | 'explanation' = 'prompt';
  for (const raw of lines) {
    const l = raw.trim();
    const explanation = section !== 'explanation' ? PREDICT_EXPLANATION.exec(l) : null;
    if (explanation) {
      section = 'explanation';
      explanationLines.push(explanation[1]);
      continue;
    }
    if (section === 'explanation') {
      explanationLines.push(raw);
      continue;
    }
    const option = PREDICT_OPTION.exec(l);
    if (option) {
      section = 'options';
      options.push({
        // Seçenek id'leri sırayla a, b, c…
        id: String.fromCharCode(97 + options.length),
        text: toBilingual(option[2]),
        correct: option[1] !== ' ',
      });
      continue;
    }
    if (section === 'options') {
      if (l === '') continue;
      throw new LessonParseError(
        `':::predict' seçeneklerinden sonra yalnızca 'Açıklama:' gelebilir: "${l}"`,
        sourcePath,
        line,
      );
    }
    promptLines.push(raw);
  }
  const prompt = promptLines.join('\n').trim();
  if (!prompt) throw new LessonParseError("':::predict' soru metni boş", sourcePath, line);
  const correct = options.filter((o) => o.correct);
  if (correct.length !== 1) {
    throw new LessonParseError(
      `':::predict' tam olarak bir doğru seçenek ('- [x]') içermeli (şu an ${correct.length})`,
      sourcePath,
      line,
    );
  }
  const explanation = explanationLines.join('\n').trim();
  return {
    prompt: toBilingual(prompt),
    options: options.map(({ id, text }) => ({ id, text })),
    correct: correct[0].id,
    explanation: explanation ? toBilingual(explanation) : undefined,
  };
}

/** Türkçe/İngilizce kaynak türü adları → ResourceKind */
const RESOURCE_KIND_ALIASES: Record<string, ResourceKind> = {
  kitap: 'book',
  makale: 'article',
  yazı: 'article',
  blog: 'article',
  belge: 'docs',
  doküman: 'docs',
  dokümantasyon: 'docs',
  belgeler: 'docs',
  video: 'video',
  konuşma: 'video',
  bildiri: 'paper',
  'akademik makale': 'paper',
  depo: 'repo',
  ...Object.fromEntries(RESOURCE_KINDS.map((k) => [k, k])),
};

const RESOURCE_ITEM = /^[-*]\s+\[([^\]]+)\]\(([^)\s]+)\)\s*(.*)$/;

/** `:::resources` gövdesi: `- [Başlık](https://…) — tür — not` satırları */
function parseResourcesBody(body: string, sourcePath?: string, line?: number) {
  const items: { title: string; url: string; kind?: ResourceKind; note?: string }[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    const m = RESOURCE_ITEM.exec(l);
    if (!m) {
      throw new LessonParseError(
        `':::resources' satırı '- [Başlık](https://…) — tür' biçiminde olmalı: "${l}"`,
        sourcePath,
        line,
      );
    }
    // Bağlantıdan sonrası: " — tür — not" (em dash, en dash ya da "--")
    const rest = m[3]
      .split(/\s+(?:—|–|--)\s+|^(?:—|–|--)\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const kind = rest.length ? RESOURCE_KIND_ALIASES[rest[0].toLocaleLowerCase('tr')] : undefined;
    const noteParts = kind ? rest.slice(1) : rest;
    items.push({
      title: m[1].trim(),
      url: m[2],
      kind,
      note: noteParts.length ? noteParts.join(' — ') : undefined,
    });
  }
  return { items };
}

export interface ParseLessonOptions {
  sourcePath?: string;
  /** İngilizce metin blokları için paralel markdown (lesson.en.md) */
  englishMarkdown?: string;
}

export class LessonParseError extends Error {
  constructor(
    message: string,
    public readonly sourcePath?: string,
    public readonly line?: number,
  ) {
    super(sourcePath ? `${sourcePath}${line ? `:${line}` : ''}: ${message}` : message);
    this.name = 'LessonParseError';
  }
}

interface RawSegment {
  kind: 'text' | 'directive';
  name?: string;
  attrs?: Record<string, string | number | boolean>;
  body: string;
  line: number;
}

function segment(markdown: string, sourcePath?: string): RawSegment[] {
  const lines = markdown.split(/\r?\n/);
  const segments: RawSegment[] = [];
  let textBuf: string[] = [];
  let textStart = 1;
  let i = 0;
  let inFence = false;

  const flushText = () => {
    const body = textBuf.join('\n').trim();
    if (body.length > 0) segments.push({ kind: 'text', body, line: textStart });
    textBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    // Üst seviye kod çitlerinin içindeki ::: satırlarını directive sayma
    if (/^```/.test(line.trim())) inFence = !inFence;
    const open = !inFence ? DIRECTIVE_OPEN.exec(line.trim()) : null;
    if (open) {
      flushText();
      const name = open[1];
      const attrs = parseDirectiveAttributes(open[2]);
      const startLine = i + 1;
      const bodyLines: string[] = [];
      i++;
      let closed = false;
      let innerFence = false;
      while (i < lines.length) {
        const l = lines[i];
        if (/^```/.test(l.trim())) innerFence = !innerFence;
        if (!innerFence && DIRECTIVE_CLOSE.test(l.trim())) {
          closed = true;
          break;
        }
        bodyLines.push(l);
        i++;
      }
      if (!closed) {
        throw new LessonParseError(`':::${name}' bloğu kapatılmamış`, sourcePath, startLine);
      }
      segments.push({ kind: 'directive', name, attrs, body: bodyLines.join('\n').trim(), line: startLine });
      i++;
      textStart = i + 1;
      continue;
    }
    if (textBuf.length === 0) textStart = i + 1;
    textBuf.push(line);
    i++;
  }
  flushText();
  return segments;
}

function requireAttr(attrs: Record<string, unknown>, key: string, name: string, sourcePath?: string, line?: number): string {
  const v = attrs[key];
  if (v === undefined || v === '') {
    throw new LessonParseError(`':::${name}' için '${key}' özniteliği zorunlu`, sourcePath, line);
  }
  return String(v);
}

/** Dosyadaki Markdown'u LessonDocument'e çevirir. */
export function parseLessonMarkdown(markdown: string, options: ParseLessonOptions = {}): LessonDocument {
  const { sourcePath } = options;
  const { data, content } = matter(markdown);
  const metaResult = LessonFrontmatterSchema.safeParse(data);
  if (!metaResult.success) {
    const msg = metaResult.error.issues.map((is) => `${is.path.join('.')}: ${is.message}`).join('; ');
    throw new LessonParseError(`Frontmatter geçersiz → ${msg}`, sourcePath, 1);
  }
  const meta = metaResult.data;

  const enSegments = options.englishMarkdown ? segment(matter(options.englishMarkdown).content, sourcePath) : null;
  const enTexts = enSegments ? enSegments.filter((s) => s.kind === 'text').map((s) => s.body) : [];
  const enDirectiveBodies = enSegments
    ? enSegments.filter((s) => s.kind === 'directive' && (s.name === 'realworld' || s.name === 'callout')).map((s) => s.body)
    : [];

  const segments = segment(content, sourcePath);
  const blocks: LessonBlock[] = [];
  let textIdx = 0;
  let richIdx = 0;
  const seenIds = new Set<string>();

  const nextId = (prefix: string) => {
    let n = 1;
    let id = `${prefix}-${n}`;
    while (seenIds.has(id)) {
      n++;
      id = `${prefix}-${n}`;
    }
    seenIds.add(id);
    return id;
  };

  segments.forEach((seg, order) => {
    if (seg.kind === 'text') {
      blocks.push({
        id: nextId('text'),
        order,
        type: 'text',
        markdown: seg.body,
        markdownEn: enTexts[textIdx],
      });
      textIdx++;
      return;
    }
    const attrs = seg.attrs ?? {};
    const name = seg.name!;
    switch (name) {
      case 'diagram':
        blocks.push({
          id: nextId('diagram'),
          order,
          type: 'diagram',
          src: requireAttr(attrs, 'src', name, sourcePath, seg.line),
          alt: toLocalized(attrs.alt) ?? toLocalized(seg.body) ?? 'Diyagram',
          caption: seg.body ? toLocalized(seg.body) : undefined,
        });
        break;
      case 'animation':
        blocks.push({
          id: nextId('animation'),
          order,
          type: 'animation',
          scene: requireAttr(attrs, 'scene', name, sourcePath, seg.line),
          caption: seg.body ? toLocalized(seg.body) : undefined,
        });
        break;
      case 'interactive': {
        const typeStr = requireAttr(attrs, 'type', name, sourcePath, seg.line);
        const typeParsed = InteractiveTypeSchema.safeParse(typeStr);
        if (!typeParsed.success) {
          throw new LessonParseError(`Bilinmeyen interaktif tür: ${typeStr}`, sourcePath, seg.line);
        }
        const { type: _t, title, ...params } = attrs;
        blocks.push({
          id: nextId('interactive'),
          order,
          type: 'interactive',
          interactive: typeParsed.data,
          params,
          title: toLocalized(title),
          instructions: seg.body ? toLocalized(seg.body) : undefined,
        });
        break;
      }
      case 'code': {
        const fenced = extractFencedCode(seg.body);
        const code = fenced ? fenced.code : seg.body;
        const language = String(attrs.lang ?? fenced?.language ?? 'text');
        // Aynı blokta birden fazla çit varsa, ilk çit ana kod, diğerleri alternatif dil sürümleri
        const alternatives: { language: string; code: string }[] = [];
        const re = /```([a-zA-Z0-9_+-]*)\s*\n([\s\S]*?)\n```/g;
        let m: RegExpExecArray | null;
        let first = true;
        while ((m = re.exec(seg.body)) !== null) {
          if (first) {
            first = false;
            continue;
          }
          alternatives.push({ language: m[1] || 'text', code: m[2] });
        }
        blocks.push({
          id: nextId('code'),
          order,
          type: 'code',
          language,
          title: toLocalized(attrs.title),
          code,
          alternatives,
          highlightLines: String(attrs.highlight ?? '')
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0),
        });
        break;
      }
      case 'realworld':
        blocks.push({
          id: nextId('realworld'),
          order,
          type: 'realworld',
          company: requireAttr(attrs, 'company', name, sourcePath, seg.line),
          markdown: seg.body,
          markdownEn: enDirectiveBodies[richIdx],
        });
        richIdx++;
        break;
      case 'callout': {
        const toneParsed = z.enum(['info', 'tip', 'warning', 'danger']).safeParse(attrs.tone ?? 'info');
        blocks.push({
          id: nextId('callout'),
          order,
          type: 'callout',
          tone: toneParsed.success ? toneParsed.data : 'info',
          title: toLocalized(attrs.title),
          markdown: seg.body,
          markdownEn: enDirectiveBodies[richIdx],
        });
        richIdx++;
        break;
      }
      case 'quiz':
        blocks.push({
          id: nextId('quiz'),
          order,
          type: 'quiz',
          src: requireAttr(attrs, 'src', name, sourcePath, seg.line),
        });
        break;
      case 'trace':
        blocks.push({
          id: nextId('trace'),
          order,
          type: 'trace',
          src: requireAttr(attrs, 'src', name, sourcePath, seg.line),
          title: toLocalized(attrs.title),
          caption: seg.body ? toLocalized(seg.body) : undefined,
        });
        break;
      case 'exercise':
        blocks.push({
          id: nextId('exercise'),
          order,
          type: 'exercise',
          src: requireAttr(attrs, 'src', name, sourcePath, seg.line),
          instructions: seg.body ? toLocalized(seg.body) : undefined,
        });
        break;
      case 'next':
        blocks.push({
          id: nextId('next'),
          order,
          type: 'next',
          lesson: requireAttr(attrs, 'lesson', name, sourcePath, seg.line),
          note: seg.body ? toLocalized(seg.body) : undefined,
        });
        break;
      case 'predict': {
        const id = requireAttr(attrs, 'id', name, sourcePath, seg.line);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
          throw new LessonParseError(`':::predict' id kebab-case olmalı: ${id}`, sourcePath, seg.line);
        }
        if (seenIds.has(id)) {
          throw new LessonParseError(`Blok id'si ders içinde benzersiz olmalı: ${id}`, sourcePath, seg.line);
        }
        seenIds.add(id);
        blocks.push({ id, order, type: 'predict', ...parsePredictBody(seg.body, sourcePath, seg.line) });
        break;
      }
      case 'resources':
        blocks.push({
          id: nextId('resources'),
          order,
          type: 'resources',
          ...parseResourcesBody(seg.body, sourcePath, seg.line),
        });
        break;
      default:
        throw new LessonParseError(`Bilinmeyen directive: ':::${name}'`, sourcePath, seg.line);
    }
  });

  return { meta, blocks, sourcePath };
}

/** Metin bloklarından düz metin çıkarır (arama indeksi için) */
export function lessonPlainText(doc: LessonDocument): string {
  return doc.blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
        case 'realworld':
        case 'callout':
          return b.markdown;
        case 'code':
          return b.code;
        case 'predict':
          return b.prompt.tr;
        default:
          return '';
      }
    })
    .join('\n')
    .replace(/[#*_`>[\]()|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
