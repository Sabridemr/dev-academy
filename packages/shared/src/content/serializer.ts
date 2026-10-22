import type { LocalizedString } from '../i18n';
import type { LessonBlock, LessonFrontmatter } from './schema';

/**
 * DERS MARKDOWN SERİLEŞTİRİCİSİ (parser.ts'nin tersi)
 * ---------------------------------------------------
 * Bir dersin frontmatter'ını ve bloklarını `lesson.md` (ve gerekiyorsa `lesson.en.md`) metnine çevirir.
 * Admin panelinde düzenlenen dersleri `content/` klasörüne geri yazmak için kullanılır.
 *
 * Hedef: `parseLessonMarkdown(serializeLesson(doc))` ayrıştırıcının ürettiği her belgeyi birebir geri
 * vermelidir (blok kimlikleri dahil; ayrıştırıcı kimlikleri tür sırasına göre yeniden üretir). Biçimin
 * ifade edemediği durumlar (ör. öznitelikte `}`, ardışık iki metin bloğu) `warnings` listesinde döner;
 * çıktı yine de ayrıştırılabilir kalır.
 *
 * Tarayıcıda da çalışır: gray-matter/js-yaml kullanmaz, küçük bir YAML yazıcısı içerir.
 */

export interface SerializeLessonInput {
  meta: LessonFrontmatter;
  blocks: LessonBlock[];
}

export interface SerializedLesson {
  /** lesson.md içeriği */
  markdown: string;
  /** lesson.en.md içeriği (yalnızca İngilizce metin bloğu varsa) */
  englishMarkdown: string | null;
  /** Biçimin birebir taşıyamadığı bilgiler (insan okunur, Türkçe) */
  warnings: string[];
}

/* ------------------------------ YAML ------------------------------ */

const YAML_RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;

/** Blok bağlamında tırnaksız yazılabilen güvenli YAML skaleri mi? (emin değilsek tırnakla) */
function isPlainSafe(s: string): boolean {
  return (
    /^[\p{L}][^\n:#]*$/u.test(s) &&
    !YAML_RESERVED.test(s) &&
    s === s.trim() &&
    ![...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) &&
    !/[\u2028\u2029]/.test(s)
  );
}

/** JSON dizgisi geçerli bir YAML çift tırnaklı skalerdir */
function yamlString(s: string): string {
  return isPlainSafe(s) ? s : JSON.stringify(s);
}

/** Akış dizisi (`[a, b]`) öğesi: virgül/köşeli parantez içermeyen kısa kimlikler tırnaksız */
function yamlFlowItem(s: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(s) &&
    !YAML_RESERVED.test(s) &&
    !/^[0-9][0-9a-fA-FxXoObB_.eE+-]*$/.test(s)
    ? s
    : JSON.stringify(s);
}

/** `quoted`: mevcut derslerdeki gibi başlıklar her zaman çift tırnaklı yazılır */
function yamlLocalized(key: string, v: LocalizedString, quoted = false): string {
  const str = (x: string) => (quoted ? JSON.stringify(x) : yamlString(x));
  if (typeof v === 'string') return `${key}: ${str(v)}`;
  const lines = [`${key}:`, `  tr: ${str(v.tr)}`];
  if (v.en !== undefined) lines.push(`  en: ${str(v.en)}`);
  return lines.join('\n');
}

export function serializeFrontmatter(meta: LessonFrontmatter): string {
  const lines = [
    '---',
    `id: ${yamlString(meta.id)}`,
    `slug: ${yamlString(meta.slug)}`,
    `module: ${yamlString(meta.module)}`,
    `order: ${meta.order}`,
    yamlLocalized('title', meta.title, true),
    yamlLocalized('summary', meta.summary),
    `durationMinutes: ${meta.durationMinutes}`,
    `level: ${meta.level}`,
    `tags: [${meta.tags.map(yamlFlowItem).join(', ')}]`,
    `prerequisites: [${meta.prerequisites.map(yamlFlowItem).join(', ')}]`,
    `concepts: [${meta.concepts.map(yamlFlowItem).join(', ')}]`,
  ];
  // Varsayılan "published"; yalnızca taslakta yazılır (mevcut dosyaların biçimi)
  if (meta.status !== 'published') lines.push(`status: ${meta.status}`);
  lines.push('---');
  return lines.join('\n');
}

/* --------------------------- Directive'ler -------------------------- */

const ATTR_KEY = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const DIRECTIVE_LINE = /^:::([a-z][a-z0-9-]*)(\{[^}]*\})?\s*$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

type Warn = (message: string) => void;

/** parser.toLocalized'ın tersi: { tr, en } → "tr|en" */
function localizedToText(v: LocalizedString, where: string, warn: Warn): string {
  if (typeof v === 'string') {
    if (v.includes('|'))
      warn(`${where}: metindeki '|' dil ayırıcısı sanılır (tr|en olarak bölünür)`);
    return v;
  }
  if (v.tr.includes('|') || (v.en ?? '').includes('|'))
    warn(`${where}: metindeki '|' dil ayırıcısıyla karışır`);
  return v.en ? `${v.tr}|${v.en}` : v.tr;
}

function attrValue(key: string, value: unknown, where: string, warn: Warn): string | null {
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    const s = String(value);
    if (NUMBER_RE.test(s)) return s;
    warn(`${where}: '${key}' sayısı (${s}) bu biçimde yazılamaz; metin olarak yazıldı`);
    return JSON.stringify(s);
  }
  if (typeof value !== 'string') {
    warn(`${where}: '${key}' değeri (${typeof value}) öznitelik olarak yazılamaz; atlandı`);
    return null;
  }
  let s = value;
  if (/[\r\n]/.test(s)) {
    warn(`${where}: '${key}' içindeki satır sonları boşluğa çevrildi`);
    s = s.replace(/\s*[\r\n]+\s*/g, ' ');
  }
  if (s.includes('}')) {
    warn(`${where}: '${key}' içindeki '}' karakteri yazılamaz; kaldırıldı`);
    s = s.replace(/}/g, '');
  }
  if (!s.includes('"')) return `"${s}"`;
  if (!s.includes("'")) return `'${s}'`;
  warn(`${where}: '${key}' hem ' hem " içeriyor; " kaldırıldı`);
  return `"${s.replace(/"/g, '')}"`;
}

function directive(
  name: string,
  attrs: [string, unknown][],
  body: string | undefined,
  where: string,
  warn: Warn,
): string {
  const parts: string[] = [];
  for (const [key, value] of attrs) {
    if (value === undefined || value === null) continue;
    if (!ATTR_KEY.test(key)) {
      warn(`${where}: '${key}' geçerli bir öznitelik adı değil; atlandı`);
      continue;
    }
    const v = attrValue(key, value, where, warn);
    if (v !== null) parts.push(`${key}=${v}`);
  }
  const head = `:::${name}${parts.length ? `{${parts.join(' ')}}` : ''}`;
  const inner = (body ?? '').trim();
  checkBody(inner, where, warn);
  return inner ? `${head}\n${inner}\n:::` : `${head}\n:::`;
}

/** Gövdede çit dışında directive açılış/kapanış satırı olursa ayrıştırıcı bloğu böler */
function checkBody(body: string, where: string, warn: Warn): void {
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (/^```/.test(t)) inFence = !inFence;
    if (!inFence && (DIRECTIVE_LINE.test(t) || /^:::\s*$/.test(t))) {
      warn(`${where}: gövdede ':::' satırı var; dosya yeniden okunurken blok bölünür`);
      return;
    }
  }
}

function fence(language: string, code: string, where: string, warn: Warn): string {
  if (/^\s*```/m.test(code)) warn(`${where}: kod içinde \`\`\` satırı var; çit erken kapanır`);
  const lang = /^[a-zA-Z0-9_+-]*$/.test(language) ? language : '';
  if (lang !== language) warn(`${where}: '${language}' dili çit etiketine yazılamaz`);
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function localizedAttr(v: LocalizedString | undefined, where: string, warn: Warn) {
  return v === undefined ? undefined : localizedToText(v, where, warn);
}

/** Tek bloğu Markdown parçasına çevirir */
export function serializeBlock(block: LessonBlock, warn: Warn = () => {}): string {
  const where = `blok ${block.order} (${block.type})`;
  const lt = (v: LocalizedString | undefined) => localizedAttr(v, where, warn);
  switch (block.type) {
    case 'text':
      checkBody(block.markdown, where, warn);
      return block.markdown.trim();
    case 'diagram':
      return directive(
        'diagram',
        [
          ['src', block.src],
          ['alt', lt(block.alt)],
        ],
        lt(block.caption),
        where,
        warn,
      );
    case 'animation':
      return directive('animation', [['scene', block.scene]], lt(block.caption), where, warn);
    case 'interactive': {
      const params = Object.entries(block.params ?? {}).filter(([k]) => {
        if (k === 'type' || k === 'title') {
          warn(`${where}: '${k}' parametresi ayrılmış bir öznitelik; atlandı`);
          return false;
        }
        return true;
      });
      return directive(
        'interactive',
        [['type', block.interactive], ...params, ['title', lt(block.title)]],
        lt(block.instructions),
        where,
        warn,
      );
    }
    case 'code': {
      if (block.alternatives.some((a) => a.title !== undefined))
        warn(`${where}: alternatif kod başlıkları Markdown biçiminde taşınamaz`);
      const body = [
        fence(block.language, block.code, where, warn),
        ...block.alternatives.map((a) => fence(a.language, a.code, where, warn)),
      ].join('\n');
      const head = directive(
        'code',
        [
          ['lang', block.language],
          ['title', lt(block.title)],
          ['highlight', block.highlightLines.length ? block.highlightLines.join(',') : undefined],
        ],
        undefined,
        where,
        warn,
      );
      // Kod gövdesi kırpılmamalı ve ::: kontrolü çit içinde anlamsız: doğrudan yerleştir
      return head.replace(/\n:::$/, `\n${body}\n:::`);
    }
    case 'realworld':
      return directive('realworld', [['company', block.company]], block.markdown, where, warn);
    case 'callout':
      return directive(
        'callout',
        [
          ['tone', block.tone],
          ['title', lt(block.title)],
        ],
        block.markdown,
        where,
        warn,
      );
    case 'quiz':
      return directive('quiz', [['src', block.src]], undefined, where, warn);
    case 'trace':
      return directive(
        'trace',
        [
          ['src', block.src],
          ['title', lt(block.title)],
        ],
        lt(block.caption),
        where,
        warn,
      );
    case 'next':
      return directive('next', [['lesson', block.lesson]], lt(block.note), where, warn);
  }
}

/* ------------------------------ Ders ------------------------------- */

function sortedBlocks(blocks: LessonBlock[]): LessonBlock[] {
  return [...blocks].sort((a, b) => a.order - b.order);
}

/** lesson.en.md: İngilizce metinler, ayrıştırıcının sıra eşlemesine (metin / realworld+callout) göre */
function serializeEnglish(
  meta: LessonFrontmatter,
  blocks: LessonBlock[],
  warn: Warn,
): string | null {
  const isRich = (b: LessonBlock) => b.type === 'realworld' || b.type === 'callout';
  const enOf = (b: LessonBlock) =>
    b.type === 'text' || b.type === 'realworld' || b.type === 'callout' ? b.markdownEn : undefined;
  if (!blocks.some((b) => enOf(b) !== undefined)) return null;

  const lastText = blocks.reduce(
    (acc, b, i) => (b.type === 'text' && enOf(b) !== undefined ? i : acc),
    -1,
  );
  const lastRich = blocks.reduce((acc, b, i) => (isRich(b) && enOf(b) !== undefined ? i : acc), -1);
  const parts: string[] = [];
  let prevWasText = false;
  blocks.forEach((b, i) => {
    const where = `blok ${b.order} (${b.type}, en)`;
    if (b.type === 'text') {
      if (i > lastText) return;
      let md = b.markdownEn;
      if (md === undefined || md.trim() === '') {
        warn(`${where}: İngilizce metin eksik; sıra eşlemesi için Türkçe metin yazıldı`);
        md = b.markdown;
      }
      if (prevWasText) {
        // Ardışık iki metin parçası tek parçaya birleşirdi; sayılmayan bir directive ile ayır
        warn(`${where}: ardışık İngilizce metinler ayırıcı directive ile bölündü`);
        parts.push(':::next{lesson="ayirici"}\n:::');
      }
      checkBody(md, where, warn);
      parts.push(md.trim());
      prevWasText = true;
      return;
    }
    if (isRich(b)) {
      if (i > lastRich) return;
      const en = enOf(b);
      if (en === undefined) warn(`${where}: İngilizce gövde eksik; Türkçe gövde yazıldı`);
      const copy = { ...b, markdown: en ?? (b as { markdown: string }).markdown } as LessonBlock;
      parts.push(serializeBlock(copy, warn));
      prevWasText = false;
      return;
    }
    parts.push(serializeBlock(b, () => {}));
    prevWasText = false;
  });
  return `${serializeFrontmatter(meta)}\n\n${parts.join('\n\n')}\n`;
}

/**
 * Ders belgesini `lesson.md` (+ İngilizce metin varsa `lesson.en.md`) metnine çevirir.
 * Blok `id`'leri yazılmaz (ayrıştırıcı tür sırasıyla üretir); seed'in doldurduğu alanlar
 * (`svg`, `sceneId`, `quizId`, `trace`, raster `width/height`) dosya biçiminde yer almaz.
 */
export function serializeLesson(doc: SerializeLessonInput): SerializedLesson {
  const warnings: string[] = [];
  const warn: Warn = (m) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const blocks = sortedBlocks(doc.blocks);
  const parts: string[] = [];
  blocks.forEach((b, i) => {
    if (b.type === 'text' && blocks[i - 1]?.type === 'text')
      warn(`blok ${b.order} (text): önceki metin bloğuyla birleşecek`);
    if (b.type === 'text' && b.markdown.trim() === '') {
      warn(`blok ${b.order} (text): boş metin bloğu yazılmadı`);
      return;
    }
    parts.push(serializeBlock(b, warn));
  });
  const markdown = `${serializeFrontmatter(doc.meta)}\n\n${parts.join('\n\n')}\n`;
  return { markdown, englishMarkdown: serializeEnglish(doc.meta, blocks, warn), warnings };
}
