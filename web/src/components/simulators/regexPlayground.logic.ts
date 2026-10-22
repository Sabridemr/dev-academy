/**
 * Regex oyun alanının saf mantığı: küçük bir regex ayrıştırıcı (yaygın token'lar → Türkçe/İngilizce
 * açıklama), iç içe niceleyici (ReDoS) tespiti, sınırlı eşleştirme ve vurgulama parçaları.
 *
 * Güvenlik: JS RegExp çalışması kesilemez (setTimeout işe yaramaz). Bu yüzden desen ve metin boyutu
 * sınırlanır, riskli desenler yalnızca çok kısa bir metin önekinde çalıştırılır.
 */

export type Bi = { tr: string; en: string };

export const MAX_PATTERN = 200;
export const MAX_TEXT = 5000;
export const MAX_MATCHES = 500;
/** ReDoS riski olan desende eşleştirmenin yapılacağı en uzun önek (iki seviye iç içe tekrarda ~2^12 yol) */
export const RISKY_TEXT_LIMIT = 12;

export type TokenKind =
  | 'literal'
  | 'escape'
  | 'class'
  | 'dot'
  | 'anchor'
  | 'quantifier'
  | 'group-open'
  | 'group-close'
  | 'alternation'
  | 'backref';

export interface RegexToken {
  text: string;
  kind: TokenKind;
  /** Grup derinliği (0 = en dış) */
  depth: number;
  desc: Bi;
  /** Yakalayan grup numarası (group-open için) */
  group?: number;
}

const ESCAPES: Record<string, Bi> = {
  d: { tr: 'bir rakam (0-9)', en: 'a digit (0-9)' },
  D: { tr: 'rakam olmayan bir karakter', en: 'a non-digit character' },
  w: { tr: 'bir kelime karakteri (harf, rakam, _)', en: 'a word character (letter, digit, _)' },
  W: { tr: 'kelime karakteri olmayan bir karakter', en: 'a non-word character' },
  s: { tr: 'bir boşluk karakteri (boşluk, sekme, satır sonu)', en: 'a whitespace character' },
  S: { tr: 'boşluk olmayan bir karakter', en: 'a non-whitespace character' },
  b: { tr: 'kelime sınırı', en: 'a word boundary' },
  B: { tr: 'kelime sınırı olmayan konum', en: 'a non-word-boundary position' },
  n: { tr: 'satır sonu', en: 'a newline' },
  t: { tr: 'sekme', en: 'a tab' },
  r: { tr: 'satır başı (CR)', en: 'a carriage return' },
};

function quantDesc(q: string): Bi {
  const lazy = q.length > 1 && q.endsWith('?') && q !== '?';
  const core = lazy ? q.slice(0, -1) : q;
  const lz = lazy
    ? { tr: ' (tembel: olabildiğince az)', en: ' (lazy: as few as possible)' }
    : { tr: '', en: '' };
  let d: Bi;
  if (core === '*') d = { tr: 'sıfır veya daha fazla', en: 'zero or more' };
  else if (core === '+') d = { tr: 'bir veya daha fazla', en: 'one or more' };
  else if (core === '?') d = { tr: 'isteğe bağlı (0 ya da 1)', en: 'optional (0 or 1)' };
  else {
    const m = /^\{(\d+)(,(\d*))?\}$/.exec(core);
    if (!m) d = { tr: 'niceleyici', en: 'quantifier' };
    else if (!m[2]) d = { tr: `tam ${m[1]} kez`, en: `exactly ${m[1]} times` };
    else if (m[3] === '') d = { tr: `en az ${m[1]} kez`, en: `at least ${m[1]} times` };
    else d = { tr: `${m[1]} ile ${m[3]} arası kez`, en: `between ${m[1]} and ${m[3]} times` };
  }
  return { tr: `önceki öğe ${d.tr}${lz.tr}`, en: `previous item ${d.en}${lz.en}` };
}

function classDesc(body: string): Bi {
  const neg = body.startsWith('^');
  const inner = neg ? body.slice(1) : body;
  const parts: Bi[] = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const e = ESCAPES[inner[i + 1]];
      parts.push(e ?? { tr: `“${inner[i + 1]}”`, en: `“${inner[i + 1]}”` });
      i += 2;
    } else if (inner[i + 1] === '-' && i + 2 < inner.length) {
      parts.push({
        tr: `${inner[i]}-${inner[i + 2]} aralığı`,
        en: `range ${inner[i]}-${inner[i + 2]}`,
      });
      i += 3;
    } else {
      parts.push({ tr: `“${inner[i]}”`, en: `“${inner[i]}”` });
      i++;
    }
  }
  const tr = parts.map((p) => p.tr).join(', ');
  const en = parts.map((p) => p.en).join(', ');
  return neg
    ? { tr: `şunlardan biri OLMAYAN karakter: ${tr}`, en: `one character NOT in: ${en}` }
    : { tr: `şunlardan bir karakter: ${tr}`, en: `one character of: ${en}` };
}

export class RegexSyntaxError extends Error {}

/** Deseni açıklama için token'lara ayırır (tam bir regex motoru değil; yaygın sözdizimi) */
export function tokenizeRegex(pattern: string): RegexToken[] {
  const out: RegexToken[] = [];
  let depth = 0;
  let groupNo = 0;
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '\\') {
      const n = pattern[i + 1];
      if (n === undefined) throw new RegexSyntaxError('\\ ile biten desen');
      if (/[1-9]/.test(n)) {
        out.push({
          text: `\\${n}`,
          kind: 'backref',
          depth,
          desc: { tr: `${n}. grubun yakaladığı metnin aynısı`, en: `same text as group ${n}` },
        });
        i += 2;
        continue;
      }
      if (n === 'k' && pattern[i + 2] === '<') {
        const end = pattern.indexOf('>', i);
        const name = pattern.slice(i + 3, end);
        out.push({
          text: pattern.slice(i, end + 1),
          kind: 'backref',
          depth,
          desc: {
            tr: `“${name}” grubunun yakaladığı metnin aynısı`,
            en: `same text as group “${name}”`,
          },
        });
        i = end + 1;
        continue;
      }
      const e = ESCAPES[n];
      out.push({
        text: `\\${n}`,
        kind: e && (n === 'b' || n === 'B') ? 'anchor' : 'escape',
        depth,
        desc: e ?? { tr: `“${n}” karakterinin kendisi`, en: `a literal “${n}”` },
      });
      i += 2;
      continue;
    }
    if (c === '[') {
      let j = i + 1;
      if (pattern[j] === '^') j++;
      if (pattern[j] === ']') j++;
      while (j < pattern.length && pattern[j] !== ']') j += pattern[j] === '\\' ? 2 : 1;
      if (j >= pattern.length) throw new RegexSyntaxError('kapanmayan [');
      const body = pattern.slice(i + 1, j);
      out.push({ text: pattern.slice(i, j + 1), kind: 'class', depth, desc: classDesc(body) });
      i = j + 1;
      continue;
    }
    if (c === '(') {
      let text = '(';
      let desc: Bi;
      let group: number | undefined;
      const rest = pattern.slice(i);
      const named = /^\(\?<([A-Za-z_]\w*)>/.exec(rest);
      const pyNamed = /^\(\?P<([A-Za-z_]\w*)>/.exec(rest);
      if (named) {
        group = ++groupNo;
        text = named[0];
        desc = {
          tr: `“${named[1]}” adlı yakalama grubu (#${group}) başlar`,
          en: `named capture group “${named[1]}” (#${group}) starts`,
        };
      } else if (pyNamed) {
        throw new RegexSyntaxError('(?P<ad>…) Python sözdizimidir; JS’de (?<ad>…) yazın');
      } else if (rest.startsWith('(?:')) {
        text = '(?:';
        desc = {
          tr: 'yakalamayan grup başlar (yalnızca gruplama)',
          en: 'non-capturing group starts',
        };
      } else if (rest.startsWith('(?=')) {
        text = '(?=';
        desc = {
          tr: 'ileri bakış: ardından şu gelmeli (tüketmez)',
          en: 'lookahead: must be followed by (not consumed)',
        };
      } else if (rest.startsWith('(?!')) {
        text = '(?!';
        desc = {
          tr: 'negatif ileri bakış: ardından şu gelmemeli',
          en: 'negative lookahead: must not be followed by',
        };
      } else if (rest.startsWith('(?<=')) {
        text = '(?<=';
        desc = { tr: 'geri bakış: öncesinde şu olmalı', en: 'lookbehind: must be preceded by' };
      } else if (rest.startsWith('(?<!')) {
        text = '(?<!';
        desc = {
          tr: 'negatif geri bakış: öncesinde şu olmamalı',
          en: 'negative lookbehind: must not be preceded by',
        };
      } else {
        group = ++groupNo;
        desc = { tr: `${group}. yakalama grubu başlar`, en: `capture group #${group} starts` };
      }
      out.push({ text, kind: 'group-open', depth, desc, group });
      depth++;
      i += text.length;
      continue;
    }
    if (c === ')') {
      if (depth === 0) throw new RegexSyntaxError('eşi olmayan )');
      depth--;
      out.push({
        text: ')',
        kind: 'group-close',
        depth,
        desc: { tr: 'grup biter', en: 'group ends' },
      });
      i++;
      continue;
    }
    if (
      c === '*' ||
      c === '+' ||
      c === '?' ||
      (c === '{' && /^\{\d+(,\d*)?\}/.test(pattern.slice(i)))
    ) {
      let q = c === '{' ? /^\{\d+(,\d*)?\}/.exec(pattern.slice(i))![0] : c;
      if (pattern[i + q.length] === '?') q += '?';
      const prev = out[out.length - 1];
      if (
        !prev ||
        prev.kind === 'group-open' ||
        prev.kind === 'alternation' ||
        (prev.kind === 'quantifier' && !q.endsWith('?'))
      )
        throw new RegexSyntaxError(`“${q}” niceleyicisinin önünde öğe yok`);
      out.push({ text: q, kind: 'quantifier', depth, desc: quantDesc(q) });
      i += q.length;
      continue;
    }
    if (c === '|') {
      out.push({
        text: '|',
        kind: 'alternation',
        depth,
        desc: { tr: 'VEYA: soldaki ya da sağdaki seçenek', en: 'OR: left or right alternative' },
      });
      i++;
      continue;
    }
    if (c === '^' || c === '$') {
      out.push({
        text: c,
        kind: 'anchor',
        depth,
        desc:
          c === '^'
            ? { tr: 'metnin (m bayrağıyla satırın) başı', en: 'start of text (of line with m)' }
            : { tr: 'metnin (m bayrağıyla satırın) sonu', en: 'end of text (of line with m)' },
      });
      i++;
      continue;
    }
    if (c === '.') {
      out.push({
        text: '.',
        kind: 'dot',
        depth,
        desc: {
          tr: 'satır sonu dışında herhangi bir karakter (s bayrağıyla o da dahil)',
          en: 'any character except newline (including it with s)',
        },
      });
      i++;
      continue;
    }
    // Ardışık düz karakterleri tek token'da topla (niceleyiciden önceki son karakter ayrı kalır)
    let j = i;
    while (j < pattern.length && !'\\[]()*+?{|^$.'.includes(pattern[j])) j++;
    if (j === i) j = i + 1;
    const nextIsQuant = j < pattern.length && '*+?{'.includes(pattern[j]);
    if (nextIsQuant && j - i > 1) j--;
    const lit = pattern.slice(i, j);
    out.push({
      text: lit,
      kind: 'literal',
      depth,
      desc: { tr: `“${lit}” metninin kendisi`, en: `the literal text “${lit}”` },
    });
    i = j;
  }
  if (depth !== 0) throw new RegexSyntaxError('kapanmayan (');
  return out;
}

export interface RedosWarning {
  /** Uyarıya neden olan alt desen */
  fragment: string;
  reason: 'nested-quantifier' | 'overlapping-alternation';
}

const isUnbounded = (q: string) => q.startsWith('*') || q.startsWith('+') || /^\{\d+,\}/.test(q);

/**
 * Felaket geri izleme (catastrophic backtracking) riski: sınırsız niceleyicili bir grup, içinde de
 * sınırsız niceleyici barındırıyorsa (`(a+)+`, `(\w+\s?)*`) ya da seçenekleri örtüşen bir alternatif
 * grubu sınırsız tekrarlanıyorsa (`(a|a)*`, `(a|ab)+`). Her tekrar, içteki niceleyicinin tüketemediği
 * sabit bir ayırıcıyla başlıyorsa (`(?:\.[\w-]+)+`, `(,\d+)*`) bölme tek yollu olduğundan uyarılmaz.
 */
export function detectRedos(pattern: string): RedosWarning[] {
  let toks: RegexToken[];
  try {
    toks = tokenizeRegex(pattern);
  } catch {
    return [];
  }
  interface Item {
    tok: RegexToken;
    quant?: string;
    /** İç grup ve içinde sınırsız tekrar var mı */
    nestedUnbounded?: boolean;
  }
  interface Frame {
    start: number;
    items: Item[];
    alts: string[];
  }
  const warnings: RedosWarning[] = [];
  const stack: Frame[] = [];
  const frameUnbounded = (f: Frame) =>
    f.items.some((it) => it.nestedUnbounded || (it.quant !== undefined && isUnbounded(it.quant)));

  /** Grup içeriği, içteki sınırsız öğelerin eşleyemediği sabit bir karakterle mi başlıyor? */
  const startsWithSeparator = (f: Frame): boolean => {
    const first = f.items[0];
    if (!first || first.quant || f.alts.length > 1) return false;
    let sep: string | undefined;
    if (first.tok.kind === 'literal') sep = first.tok.text[0];
    else if (first.tok.kind === 'escape' && !ESCAPES[first.tok.text[1]]) sep = first.tok.text[1];
    if (sep === undefined) return false;
    return f.items.every((it) => {
      if (it.nestedUnbounded) return false;
      if (it.quant === undefined || !isUnbounded(it.quant)) return true;
      try {
        return !new RegExp(`^(?:${it.tok.text})$`).test(sep);
      } catch {
        return false;
      }
    });
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const top = stack[stack.length - 1];
    if (t.kind === 'group-open') {
      stack.push({ start: i, items: [], alts: [''] });
      continue;
    }
    if (t.kind === 'group-close') {
      const g = stack.pop()!;
      const next = toks[i + 1];
      const quant = next?.kind === 'quantifier' ? next.text : undefined;
      const quantified = quant !== undefined && isUnbounded(quant);
      const fragment = toks
        .slice(g.start, quant ? i + 2 : i + 1)
        .map((x) => x.text)
        .join('');
      const inner = frameUnbounded(g);
      if (quantified && inner && !startsWithSeparator(g))
        warnings.push({ fragment, reason: 'nested-quantifier' });
      else if (quantified && g.alts.length > 1) {
        const overlap = g.alts.some((a, x) =>
          g.alts.some((b, y) => x !== y && (a === b || (a.length > 0 && b.startsWith(a)))),
        );
        if (overlap) warnings.push({ fragment, reason: 'overlapping-alternation' });
      }
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.items.push({ tok: { ...t, text: fragment }, quant, nestedUnbounded: inner });
        parent.alts[parent.alts.length - 1] += fragment;
      }
      if (quant) i++;
      continue;
    }
    if (!top) continue;
    if (t.kind === 'alternation') {
      top.alts.push('');
      continue;
    }
    if (t.kind === 'quantifier') {
      const last = top.items[top.items.length - 1];
      if (last) last.quant = t.text;
    } else top.items.push({ tok: t });
    top.alts[top.alts.length - 1] += t.text;
  }
  return warnings;
}

export interface GroupSpan {
  index: number;
  name?: string;
  start: number;
  end: number;
  text: string;
}

export interface RegexMatch {
  start: number;
  end: number;
  text: string;
  groups: GroupSpan[];
}

export interface RunResult {
  ok: boolean;
  error?: string;
  matches: RegexMatch[];
  truncated: boolean;
}

export type Flag = 'g' | 'i' | 'm' | 's';
export const FLAGS: Flag[] = ['g', 'i', 'm', 's'];

/** Deseni çalıştırır. Sıfır uzunluklu eşleşmelerde ilerler, MAX_MATCHES ile sınırlar */
export function runRegex(pattern: string, flags: string, text: string): RunResult {
  if (pattern.length > MAX_PATTERN)
    return { ok: false, error: `pattern > ${MAX_PATTERN}`, matches: [], truncated: false };
  const safeFlags = Array.from(new Set(flags.split('').filter((f) => 'gims'.includes(f)))).join('');
  let re: RegExp;
  try {
    re = new RegExp(pattern, safeFlags + 'd');
  } catch (e) {
    return { ok: false, error: (e as Error).message, matches: [], truncated: false };
  }
  const input = text.slice(0, MAX_TEXT);
  const names = groupNames(pattern);
  const matches: RegexMatch[] = [];
  const global = safeFlags.includes('g');
  let truncated = text.length > MAX_TEXT;
  re.lastIndex = 0;
  for (;;) {
    const m = re.exec(input);
    if (!m) break;
    const indices = (m as RegExpExecArray & { indices?: ([number, number] | undefined)[] }).indices;
    const groups: GroupSpan[] = [];
    for (let g = 1; g < m.length; g++) {
      const span = indices?.[g];
      if (!span || m[g] === undefined) continue;
      groups.push({ index: g, name: names[g], start: span[0], end: span[1], text: m[g] });
    }
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], groups });
    if (!global) break;
    if (m[0].length === 0) re.lastIndex++;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
  }
  return { ok: true, matches, truncated };
}

/** Grup numarası → ad (adlandırılmış gruplar için) */
export function groupNames(pattern: string): Record<number, string> {
  const out: Record<number, string> = {};
  try {
    for (const t of tokenizeRegex(pattern)) {
      if (t.kind === 'group-open' && t.group) {
        const m = /^\(\?<([A-Za-z_]\w*)>/.exec(t.text);
        if (m) out[t.group] = m[1];
      }
    }
  } catch {
    /* açıklama ayrıştırıcısı desteklemiyorsa adsız göster */
  }
  return out;
}

export interface Segment {
  text: string;
  /** Eşleşme sırası (yoksa eşleşme dışı) */
  match?: number;
  /** En içteki grup numarası */
  group?: number;
}

/** Metni vurgulama parçalarına böler: her karakter için eşleşme ve en içteki (en dar) grup */
export function segments(text: string, matches: RegexMatch[]): Segment[] {
  const n = text.length;
  const mOf = new Array<number | undefined>(n);
  const gOf = new Array<number | undefined>(n);
  const gLen = new Array<number>(n).fill(Infinity);
  matches.forEach((m, mi) => {
    for (let k = m.start; k < m.end && k < n; k++) mOf[k] = mi;
    for (const g of m.groups) {
      const len = g.end - g.start;
      for (let k = g.start; k < g.end && k < n; k++) {
        if (len <= gLen[k]) {
          gLen[k] = len;
          gOf[k] = g.index;
        }
      }
    }
  });
  const out: Segment[] = [];
  for (let k = 0; k < n; k++) {
    const last = out[out.length - 1];
    if (last && last.match === mOf[k] && last.group === gOf[k]) last.text += text[k];
    else out.push({ text: text[k], match: mOf[k], group: gOf[k] });
  }
  return out;
}

export type PresetId = 'email' | 'phone-tr' | 'date' | 'log';
export const PRESET_IDS: PresetId[] = ['email', 'phone-tr', 'date', 'log'];

export const PRESETS: Record<
  PresetId,
  { label: Bi; pattern: string; flags: string; text: string }
> = {
  email: {
    label: { tr: 'E-posta', en: 'Email' },
    pattern: '([\\w.+-]+)@([\\w-]+(?:\\.[\\w-]+)+)',
    flags: 'g',
    text: 'İletişim: ada@example.com, destek+fatura@mail.example.org\nGeçersiz: ada@, @example.com',
  },
  'phone-tr': {
    label: { tr: 'Türk telefonu', en: 'Turkish phone' },
    pattern: '(\\+90|0)?\\s?(5\\d{2})\\s?(\\d{3})\\s?(\\d{2})\\s?(\\d{2})',
    flags: 'g',
    text: 'Ara: 0532 123 45 67 ya da +90 555 765 43 21\nSabit hat değil: 0212 444 00 00',
  },
  date: {
    label: { tr: 'Tarih (GG.AA.YYYY)', en: 'Date (DD.MM.YYYY)' },
    pattern: '(?<gun>0[1-9]|[12]\\d|3[01])\\.(?<ay>0[1-9]|1[0-2])\\.(?<yil>\\d{4})',
    flags: 'g',
    text: 'Başvuru 29.10.2023, son gün 15.01.2024. Hatalı: 32.13.2024',
  },
  log: {
    label: { tr: 'Log satırı', en: 'Log line' },
    pattern:
      '^(?<tarih>\\d{4}-\\d{2}-\\d{2}) (?<saat>\\d{2}:\\d{2}:\\d{2}) (?<seviye>INFO|WARNING|ERROR) (?<mesaj>.*)$',
    flags: 'gm',
    text: [
      '2024-03-18 09:14:02 INFO sunucu başladı port=8000',
      '2024-03-18 09:15:47 WARNING disk %85 dolu',
      'bozuk satır: tarih yok',
      '2024-03-18 09:16:03 ERROR veritabanına bağlanılamadı',
    ].join('\n'),
  },
};
