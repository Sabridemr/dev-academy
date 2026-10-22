/**
 * PYTHON BELLEK MODELİ — mini yorumlayıcı (saf mantık)
 * ----------------------------------------------------
 * Küçük bir Python alt kümesini adım adım yorumlar ve her deyimden sonra belleğin anlık görüntüsünü
 * (çerçeveler, isimler, heap nesneleri, referans sayıları) kaydeder. Gerçek Python ÇALIŞTIRILMAZ;
 * CPython'un isim → nesne → referans modeli sadeleştirilerek taklit edilir:
 *
 * - Her değer heap'te bir nesnedir; isimler (çerçeve değişkenleri) ve kap nesnelerinin yuvaları
 *   nesnelere referanstır. Referans sayısı = isimlerden + kap yuvalarından gelen referanslar.
 * - Her deyimden sonra referans sayısı sıfıra inen nesne hemen silinir (zincirleme); döngüsel
 *   referanslar yalnızca `gc.collect()` ile toplanır.
 * - -5…256 arası int'ler, True/False/None önbellekte/tekil (silinmez); tanımlayıcıya benzeyen str
 *   literal'leri interned (canlı eşiti varsa yeniden kullanılır). Satırlar etkileşimli kabuğa (REPL)
 *   tek tek yazılmış gibi yorumlanır: üst düzeydeki ifade deyimi None değilse değeri çıktıya yazılır.
 *
 * Desteklenen: atama (`=`, `+=`, `-=`, `*=`), int/float/str/bool/None, list/tuple/dict literal'leri,
 * `+ - * // %`, karşılaştırmalar (`is`, `is not`, `==`, `!=`, `<`…), indeks okuma/yazma, `a[:]`,
 * `del`, `def` (tek düzey gövde, konumsal parametreler) ve `return`, `print`, `len`, `id`, `list`,
 * `tuple`, liste metotları (`append`, `extend`, `insert`, `pop`, `remove`, `clear`, `copy`),
 * `dict.copy`, `import copy` (`copy.copy`, `copy.deepcopy`), `import gc` (`gc.collect`).
 * Desteklenmeyen bir yapı (if, for, class…) anlaşılır bir hatayla reddedilir.
 */

export const PY_MEMORY_SCENARIOS = [
  'aliasing',
  'shallow-vs-deep',
  'immutable-rebind',
  'function-args',
  'refcount-gc',
] as const;
export type PyMemoryScenario = (typeof PY_MEMORY_SCENARIOS)[number];

export const SCENARIO_CODE: Record<PyMemoryScenario, string> = {
  aliasing: `a = [1, 2, 3]
b = a
b.append(4)
print(a)
print(a is b)
c = [1, 2, 3, 4]
print(a == c, a is c)
a = a + [5]
print(a is b, b)`,
  'shallow-vs-deep': `import copy
orijinal = [[1, 2], [3, 4]]
takma_ad = orijinal
sig = copy.copy(orijinal)
derin = copy.deepcopy(orijinal)
sig[0].append(99)
print(orijinal)
print(derin)
print(sig is orijinal, sig[0] is orijinal[0])`,
  'immutable-rebind': `x = 300
y = x
x = x + 1
print(x, y)
s = "merhaba"
t = s
s += " dünya"
print(s, t)
k = (1, [2])
k[1].append(3)
print(k)
k[0] = 5`,
  'function-args': `def ekle(liste, oge):
    liste.append(oge)
    return liste

def yeniden_bagla(liste):
    liste = [0]
    return liste

def artir(n):
    n = n + 1
    return n

sayilar = [1, 2]
sonuc = ekle(sayilar, 3)
print(sayilar, sonuc is sayilar)
yeni = yeniden_bagla(sayilar)
print(sayilar, yeni)
x = 5
y = artir(x)
print(x, y)`,
  'refcount-gc': `import gc
a = [1, 2]
b = a
del a
b = None
dis = [[10], [20]]
del dis
dugum = []
dugum.append(dugum)
del dugum
gc.collect()`,
};

/* ------------------------------- Tipler ------------------------------- */

export type Localized = { tr: string; en: string };

export interface PyError {
  /** 1 tabanlı satır */
  line: number;
  /** syntax: sözdizimi; unsupported: alt kümede yok; runtime: Python'un da vereceği hata; limit: adım/derinlik sınırı */
  kind: 'syntax' | 'unsupported' | 'runtime' | 'limit';
  message: Localized;
}

export type PyType =
  'int' | 'float' | 'str' | 'bool' | 'NoneType' | 'list' | 'tuple' | 'dict' | 'function' | 'module';

export interface PyObjectView {
  id: number;
  type: PyType;
  mutable: boolean;
  /** int önbelleği (-5…256) ya da True/False/None: hiç silinmez */
  cached: boolean;
  /** Python repr() karşılığı */
  repr: string;
  /** list/tuple elemanları (nesne kimlikleri) */
  items?: number[];
  /** dict anahtar-değer çiftleri (nesne kimlikleri) */
  entries?: [number, number][];
  refcount: number;
}

export interface PyFrameView {
  id: number;
  /** 'global' ya da fonksiyon adı */
  name: string;
  vars: [string, number][];
}

export type PyEvent =
  | { kind: 'create'; id: number; type: PyType }
  | { kind: 'reuse'; id: number; reason: 'small-int' | 'interned' | 'singleton' }
  | { kind: 'bind'; frame: string; name: string; id: number }
  | { kind: 'unbind'; frame: string; name: string }
  | { kind: 'mutate'; id: number }
  | { kind: 'free'; id: number; type: PyType; repr: string; cycle: boolean }
  | { kind: 'call'; fn: string }
  | { kind: 'return'; fn: string; id: number }
  | { kind: 'gc'; freed: number }
  | { kind: 'print'; text: string };

export interface PyStep {
  /** Az önce çalışan satır (0: program başlamadı) */
  line: number;
  frames: PyFrameView[];
  heap: PyObjectView[];
  output: string[];
  events: PyEvent[];
  /** Bu adımda silinen nesneler (görselde soluk gösterilir) */
  freed: { id: number; type: PyType; repr: string }[];
  error?: PyError;
}

export interface PyRun {
  steps: PyStep[];
  /** Sözdizimi/desteklenmeyen yapı hatası: steps boştur. Çalışma zamanı hatası: son adımda da bulunur */
  error?: PyError;
}

export const MAX_STEPS = 400;
const MAX_DEPTH = 40;
const MAX_LINES = 60;

/* ------------------------------ Belirteçler ------------------------------ */

type Tok =
  | { t: 'num'; v: number; text: string }
  | { t: 'str'; v: string }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string }
  | { t: 'end' };

class ParseError extends Error {
  constructor(
    public line: number,
    public kind: 'syntax' | 'unsupported',
    public msg: Localized,
  ) {
    super(msg.en);
  }
}

const OPS = [
  '**',
  '//',
  '==',
  '!=',
  '<=',
  '>=',
  '+=',
  '-=',
  '*=',
  '->',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  ',',
  ':',
  '.',
  '=',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '/',
  '&',
  '|',
  '^',
  '~',
  '@',
  ';',
];

/** Alt kümede olmayan Python anahtar sözcükleri: anlaşılır "desteklenmiyor" hatası için */
const UNSUPPORTED_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'for',
  'while',
  'class',
  'lambda',
  'with',
  'try',
  'except',
  'finally',
  'global',
  'nonlocal',
  'yield',
  'from',
  'as',
  'and',
  'or',
  'in',
  'async',
  'await',
  'raise',
  'assert',
  'break',
  'continue',
  'match',
]);

const unsupported = (line: number, tr: string, en: string) =>
  new ParseError(line, 'unsupported', { tr, en });
const syntax = (line: number, tr: string, en: string) => new ParseError(line, 'syntax', { tr, en });

function tokenize(src: string, line: number): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '#') break;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d[\d_]*)?(\.\d[\d_]*)?([eE][+-]?\d+)?/.exec(src.slice(i))!;
      const text = m[0];
      if (
        /^[0-9.]/.test(src[i + text.length] ?? '') ||
        /[a-zA-Z_]/.test(src[i + text.length] ?? '')
      )
        throw syntax(
          line,
          `Geçersiz sayı: ${src.slice(i, i + text.length + 1)}`,
          `Invalid number: ${src.slice(i, i + text.length + 1)}`,
        );
      const v = Number(text.replace(/_/g, ''));
      out.push({ t: 'num', v, text });
      i += text.length;
      continue;
    }
    if (/[a-zA-Z_À-￿]/.test(c)) {
      const m = /^[a-zA-Z_À-￿][\wÀ-￿]*/.exec(src.slice(i))!;
      const name = m[0];
      const next = src[i + name.length];
      if ((next === '"' || next === "'") && /^[rRbBfFuU]{1,2}$/.test(name)) {
        throw unsupported(
          line,
          `${name}"…" önekli string (f-string, bytes, raw) bu simülatörde desteklenmiyor`,
          `${name}"…" prefixed strings (f-strings, bytes, raw) are not supported in this simulator`,
        );
      }
      out.push({ t: 'name', v: name });
      i += name.length;
      continue;
    }
    if (c === '"' || c === "'") {
      if (src.startsWith(c.repeat(3), i))
        throw unsupported(
          line,
          'Üç tırnaklı string desteklenmiyor',
          'Triple-quoted strings are not supported',
        );
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') {
          const e = src[j + 1];
          const map: Record<string, string> = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"' };
          if (e === undefined || !(e in map))
            throw unsupported(
              line,
              `Desteklenmeyen kaçış dizisi: \\${e ?? ''}`,
              `Unsupported escape sequence: \\${e ?? ''}`,
            );
          s += map[e];
          j += 2;
          continue;
        }
        s += src[j];
        j++;
      }
      if (j >= src.length) throw syntax(line, 'Kapanmamış string', 'Unterminated string literal');
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw syntax(line, `Geçersiz karakter: ${c}`, `Invalid character: ${c}`);
    if ('([{'.includes(op)) depth++;
    if (')]}'.includes(op)) depth--;
    out.push({ t: 'op', v: op });
    i += op.length;
  }
  if (depth > 0)
    throw unsupported(
      line,
      'Parantez bu satırda kapanmıyor; çok satırlı ifadeler desteklenmiyor',
      'Bracket is not closed on this line; multi-line expressions are not supported',
    );
  out.push({ t: 'end' });
  return out;
}

/* --------------------------------- AST --------------------------------- */

type Expr =
  | { k: 'num'; v: number; float: boolean }
  | { k: 'str'; v: string }
  | { k: 'const'; v: 'True' | 'False' | 'None' }
  | { k: 'name'; name: string }
  | { k: 'list'; items: Expr[] }
  | { k: 'tuple'; items: Expr[] }
  | { k: 'dict'; entries: [Expr, Expr][] }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'cmp'; op: string; l: Expr; r: Expr }
  | { k: 'neg'; e: Expr }
  | { k: 'call'; fn: Expr; args: Expr[] }
  | { k: 'sub'; obj: Expr; index: Expr }
  | { k: 'slice'; obj: Expr }
  | { k: 'attr'; obj: Expr; name: string };

type Target = { k: 'name'; name: string } | { k: 'sub'; obj: Expr; index: Expr };

interface DefStmt {
  k: 'def';
  name: string;
  params: string[];
  body: Stmt[];
  line: number;
}

type Stmt =
  | { k: 'expr'; e: Expr; line: number }
  | { k: 'assign'; target: Target; e: Expr; line: number }
  | { k: 'aug'; target: Target; op: string; e: Expr; line: number }
  | { k: 'del'; targets: Target[]; line: number }
  | { k: 'import'; mod: 'copy' | 'gc'; line: number }
  | { k: 'return'; e?: Expr; line: number }
  | { k: 'pass'; line: number }
  | DefStmt;

const LIST_METHODS = new Set(['append', 'extend', 'insert', 'pop', 'remove', 'clear', 'copy']);
const DICT_METHODS = new Set(['copy']);
const BUILTINS = new Set(['print', 'len', 'id', 'list', 'tuple']);

class Parser {
  private i = 0;
  constructor(
    private toks: Tok[],
    private line: number,
  ) {}

  peek(): Tok {
    return this.toks[this.i];
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }
  isName(v: string): boolean {
    const t = this.peek();
    return t.t === 'name' && t.v === v;
  }
  next(): Tok {
    return this.toks[this.i++];
  }
  expectOp(v: string) {
    if (!this.isOp(v)) throw syntax(this.line, `'${v}' bekleniyordu`, `Expected '${v}'`);
    this.i++;
  }
  atEnd(): boolean {
    return this.peek().t === 'end';
  }
  expectEnd() {
    if (!this.atEnd()) {
      const t = this.peek();
      const text = t.t === 'end' ? '' : String(t.v);
      if (t.t === 'op' && t.v === ';')
        throw unsupported(
          this.line,
          'Bir satıra tek deyim yazın (; desteklenmiyor)',
          'Write one statement per line (; is not supported)',
        );
      throw syntax(this.line, `Beklenmeyen belirteç: ${text}`, `Unexpected token: ${text}`);
    }
  }

  /** İfade listesi: `1, 2` → tuple */
  exprList(): Expr {
    const first = this.expr();
    if (!this.isOp(',')) return first;
    const items = [first];
    while (this.isOp(',')) {
      this.i++;
      if (this.atEnd() || this.isOp('=') || this.isOp(')')) break;
      items.push(this.expr());
    }
    return { k: 'tuple', items };
  }

  expr(): Expr {
    const l = this.additive();
    const t = this.peek();
    if (t.t === 'name' && t.v === 'is') {
      this.i++;
      const not = this.isName('not');
      if (not) this.i++;
      return { k: 'cmp', op: not ? 'is not' : 'is', l, r: this.additive() };
    }
    if (t.t === 'name' && (t.v === 'not' || t.v === 'in')) {
      throw unsupported(
        this.line,
        `'${t.v}' işleci desteklenmiyor`,
        `The '${t.v}' operator is not supported`,
      );
    }
    if (t.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(t.v)) {
      this.i++;
      const r = this.additive();
      const n = this.peek();
      if (n.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(n.v))
        throw unsupported(
          this.line,
          'Zincirleme karşılaştırma desteklenmiyor',
          'Chained comparisons are not supported',
        );
      return { k: 'cmp', op: t.v, l, r };
    }
    return l;
  }

  additive(): Expr {
    let l = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.next() as { v: string }).v;
      l = { k: 'bin', op, l, r: this.term() };
    }
    return l;
  }

  term(): Expr {
    let l = this.unary();
    while (
      this.isOp('*') ||
      this.isOp('//') ||
      this.isOp('%') ||
      this.isOp('/') ||
      this.isOp('**')
    ) {
      const op = (this.next() as { v: string }).v;
      if (op === '/' || op === '**')
        throw unsupported(
          this.line,
          `'${op}' işleci desteklenmiyor (// ve % kullanın)`,
          `The '${op}' operator is not supported (use // and %)`,
        );
      l = { k: 'bin', op, l, r: this.unary() };
    }
    return l;
  }

  unary(): Expr {
    if (this.isOp('-')) {
      this.i++;
      return { k: 'neg', e: this.unary() };
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.postfix();
  }

  postfix(): Expr {
    let e = this.atom();
    for (;;) {
      if (this.isOp('(')) {
        this.i++;
        const args: Expr[] = [];
        while (!this.isOp(')')) {
          const t = this.peek();
          const after = this.toks[this.i + 1];
          if (t.t === 'name' && after?.t === 'op' && after.v === '=')
            throw unsupported(
              this.line,
              'İsimli argüman (ad=değer) desteklenmiyor',
              'Keyword arguments (name=value) are not supported',
            );
          if (this.isOp('*') || this.isOp('**'))
            throw unsupported(
              this.line,
              '*args/**kwargs desteklenmiyor',
              '*args/**kwargs are not supported',
            );
          args.push(this.expr());
          if (!this.isOp(',')) break;
          this.i++;
        }
        this.expectOp(')');
        e = { k: 'call', fn: e, args };
      } else if (this.isOp('[')) {
        this.i++;
        if (this.isOp(':')) {
          this.i++;
          if (!this.isOp(']'))
            throw unsupported(
              this.line,
              'Yalnızca tam dilim a[:] desteklenir',
              'Only the full slice a[:] is supported',
            );
          this.i++;
          e = { k: 'slice', obj: e };
          continue;
        }
        const index = this.expr();
        if (this.isOp(':'))
          throw unsupported(
            this.line,
            'Yalnızca tam dilim a[:] desteklenir',
            'Only the full slice a[:] is supported',
          );
        this.expectOp(']');
        e = { k: 'sub', obj: e, index };
      } else if (this.isOp('.')) {
        this.i++;
        const t = this.next();
        if (t.t !== 'name')
          throw syntax(this.line, "'.' sonrası isim bekleniyordu", "Expected a name after '.'");
        e = { k: 'attr', obj: e, name: t.v };
      } else {
        return e;
      }
    }
  }

  atom(): Expr {
    const t = this.next();
    if (t.t === 'num') return { k: 'num', v: t.v, float: /[.eE]/.test(t.text) };
    if (t.t === 'str') {
      let v = t.v;
      // Yan yana string literal'leri birleşir
      while (this.peek().t === 'str') v += (this.next() as { v: string }).v;
      return { k: 'str', v };
    }
    if (t.t === 'name') {
      if (t.v === 'True' || t.v === 'False' || t.v === 'None') return { k: 'const', v: t.v };
      if (
        UNSUPPORTED_KEYWORDS.has(t.v) ||
        t.v === 'def' ||
        t.v === 'return' ||
        t.v === 'del' ||
        t.v === 'import' ||
        t.v === 'not' ||
        t.v === 'is'
      )
        throw unsupported(
          this.line,
          `'${t.v}' bu konumda desteklenmiyor`,
          `'${t.v}' is not supported here`,
        );
      return { k: 'name', name: t.v };
    }
    if (t.t === 'op' && t.v === '(') {
      if (this.isOp(')')) {
        this.i++;
        return { k: 'tuple', items: [] };
      }
      const first = this.expr();
      if (this.isName('for'))
        throw unsupported(
          this.line,
          'Generator ifadesi desteklenmiyor',
          'Generator expressions are not supported',
        );
      if (this.isOp(')')) {
        this.i++;
        return first;
      }
      const items = [first];
      while (this.isOp(',')) {
        this.i++;
        if (this.isOp(')')) break;
        items.push(this.expr());
      }
      this.expectOp(')');
      return { k: 'tuple', items };
    }
    if (t.t === 'op' && t.v === '[') {
      const items: Expr[] = [];
      while (!this.isOp(']')) {
        items.push(this.expr());
        if (this.isName('for'))
          throw unsupported(
            this.line,
            'List comprehension desteklenmiyor',
            'List comprehensions are not supported',
          );
        if (!this.isOp(',')) break;
        this.i++;
      }
      this.expectOp(']');
      return { k: 'list', items };
    }
    if (t.t === 'op' && t.v === '{') {
      const entries: [Expr, Expr][] = [];
      while (!this.isOp('}')) {
        const key = this.expr();
        if (!this.isOp(':'))
          throw unsupported(
            this.line,
            'set literal ve dict comprehension desteklenmiyor; {anahtar: değer} yazın',
            'Set literals and dict comprehensions are not supported; write {key: value}',
          );
        this.i++;
        entries.push([key, this.expr()]);
        if (this.isName('for'))
          throw unsupported(
            this.line,
            'Dict comprehension desteklenmiyor',
            'Dict comprehensions are not supported',
          );
        if (!this.isOp(',')) break;
        this.i++;
      }
      this.expectOp('}');
      return { k: 'dict', entries };
    }
    const text = t.t === 'end' ? 'satır sonu' : String(t.v);
    throw syntax(
      this.line,
      `Beklenmeyen belirteç: ${text}`,
      `Unexpected token: ${t.t === 'end' ? 'end of line' : String(t.v)}`,
    );
  }
}

function toTarget(e: Expr, line: number): Target {
  if (e.k === 'name') return { k: 'name', name: e.name };
  if (e.k === 'sub') return { k: 'sub', obj: e.obj, index: e.index };
  if (e.k === 'tuple')
    throw unsupported(
      line,
      'Çoklu atama (a, b = …) desteklenmiyor',
      'Tuple unpacking (a, b = …) is not supported',
    );
  if (e.k === 'attr')
    throw unsupported(
      line,
      'Nitelik ataması (a.x = …) desteklenmiyor',
      'Attribute assignment (a.x = …) is not supported',
    );
  throw syntax(line, 'Bu ifadeye atama yapılamaz', 'Cannot assign to this expression');
}

/** Çağrıların alt kümede olduğunu ayrıştırma sırasında denetler (yöntem/fonksiyon adları) */
function checkExpr(e: Expr, line: number) {
  switch (e.k) {
    case 'list':
    case 'tuple':
      e.items.forEach((x) => checkExpr(x, line));
      return;
    case 'dict':
      e.entries.forEach(([a, b]) => {
        checkExpr(a, line);
        checkExpr(b, line);
      });
      return;
    case 'bin':
    case 'cmp':
      checkExpr(e.l, line);
      checkExpr(e.r, line);
      return;
    case 'neg':
      checkExpr(e.e, line);
      return;
    case 'sub':
      checkExpr(e.obj, line);
      checkExpr(e.index, line);
      return;
    case 'slice':
      checkExpr(e.obj, line);
      return;
    case 'attr':
      throw unsupported(
        line,
        `Nitelik okuma (.${e.name}) yalnızca metot çağrısında desteklenir`,
        `Attribute access (.${e.name}) is only supported in method calls`,
      );
    case 'call': {
      e.args.forEach((x) => checkExpr(x, line));
      if (e.fn.k === 'name') return;
      if (e.fn.k === 'attr') {
        checkExpr(e.fn.obj, line);
        const obj = e.fn.obj;
        const m = e.fn.name;
        if (obj.k === 'name' && obj.name === 'copy' && (m === 'copy' || m === 'deepcopy')) return;
        if (obj.k === 'name' && obj.name === 'gc' && m === 'collect') return;
        if (LIST_METHODS.has(m) || DICT_METHODS.has(m)) return;
        throw unsupported(
          line,
          `.${m}() metodu bu simülatörde yok (desteklenenler: ${[...LIST_METHODS].join(', ')}, copy.copy, copy.deepcopy, gc.collect)`,
          `The .${m}() method is not available here (supported: ${[...LIST_METHODS].join(', ')}, copy.copy, copy.deepcopy, gc.collect)`,
        );
      }
      throw unsupported(line, 'Bu çağrı biçimi desteklenmiyor', 'This call form is not supported');
    }
    default:
      return;
  }
}

function parseSimple(text: string, line: number, inFunction: boolean): Stmt {
  const toks = tokenize(text, line);
  const first = toks[0];
  if (first.t === 'name') {
    if (UNSUPPORTED_KEYWORDS.has(first.v))
      throw unsupported(
        line,
        `'${first.v}' bu simülatörde desteklenmiyor; yalnızca atama, del, def/return, import copy/gc ve ifadeler yorumlanır`,
        `'${first.v}' is not supported in this simulator; only assignment, del, def/return, import copy/gc and expressions are interpreted`,
      );
    if (first.v === 'pass' && toks[1].t === 'end') return { k: 'pass', line };
    if (first.v === 'import') {
      const mod = toks[1];
      if (mod.t !== 'name' || toks[2].t !== 'end')
        throw unsupported(
          line,
          'Yalnızca "import copy" ve "import gc" desteklenir',
          'Only "import copy" and "import gc" are supported',
        );
      if (mod.v !== 'copy' && mod.v !== 'gc')
        throw unsupported(
          line,
          `"${mod.v}" modülü bu simülatörde yok (copy ve gc var)`,
          `The "${mod.v}" module is not available (copy and gc are)`,
        );
      return { k: 'import', mod: mod.v, line };
    }
    if (first.v === 'return') {
      if (!inFunction)
        throw syntax(line, "'return' fonksiyon dışında", "'return' outside function");
      const p = new Parser(toks, line);
      p.next();
      if (p.atEnd()) return { k: 'return', line };
      const e = p.exprList();
      p.expectEnd();
      checkExpr(e, line);
      return { k: 'return', e, line };
    }
    if (first.v === 'del') {
      const p = new Parser(toks, line);
      p.next();
      const targets: Target[] = [];
      for (;;) {
        const e = p.expr();
        checkExpr(e, line);
        targets.push(toTarget(e, line));
        if (!p.isOp(',')) break;
        p.next();
      }
      p.expectEnd();
      return { k: 'del', targets, line };
    }
  }
  const p = new Parser(toks, line);
  const lhs = p.exprList();
  const t = p.peek();
  if (t.t === 'op' && t.v === '=') {
    p.next();
    const rhs = p.exprList();
    if (p.isOp('='))
      throw unsupported(
        line,
        'Zincirleme atama (a = b = …) desteklenmiyor',
        'Chained assignment (a = b = …) is not supported',
      );
    p.expectEnd();
    checkExpr(rhs, line);
    const target = toTarget(lhs, line);
    if (target.k === 'sub') {
      checkExpr(target.obj, line);
      checkExpr(target.index, line);
    }
    return { k: 'assign', target, e: rhs, line };
  }
  if (t.t === 'op' && (t.v === '+=' || t.v === '-=' || t.v === '*=')) {
    p.next();
    const rhs = p.exprList();
    p.expectEnd();
    checkExpr(rhs, line);
    const target = toTarget(lhs, line);
    return { k: 'aug', target, op: t.v[0], e: rhs, line };
  }
  if (t.t === 'op' && t.v === ':')
    throw unsupported(
      line,
      'Tip açıklaması / blok başlığı desteklenmiyor',
      'Annotations / block headers are not supported',
    );
  p.expectEnd();
  checkExpr(lhs, line);
  return { k: 'expr', e: lhs, line };
}

const indentOf = (s: string) => s.length - s.trimStart().length;
const isBlank = (s: string) => s.trim() === '' || s.trim().startsWith('#');

/** Kaynağı deyimlere ayrıştırır; hata varsa ParseError fırlatır */
export function parseProgram(src: string): Stmt[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > MAX_LINES)
    throw new ParseError(MAX_LINES + 1, 'unsupported', {
      tr: `Program en fazla ${MAX_LINES} satır olabilir`,
      en: `The program can have at most ${MAX_LINES} lines`,
    });
  const out: Stmt[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const lineNo = i + 1;
    if (isBlank(raw)) {
      i++;
      continue;
    }
    if (raw.includes('\t'))
      throw unsupported(
        lineNo,
        'Girintide sekme yerine boşluk kullanın',
        'Use spaces instead of tabs for indentation',
      );
    if (indentOf(raw) > 0) throw syntax(lineNo, 'Beklenmeyen girinti', 'Unexpected indent');
    const text = raw.trim();
    if (text.startsWith('def ') || text === 'def') {
      const m = /^def\s+([A-Za-z_À-￿][\wÀ-￿]*)\s*\(([^)]*)\)\s*:\s*(#.*)?$/.exec(text);
      if (!m)
        throw syntax(
          lineNo,
          'def satırı "def ad(p1, p2):" biçiminde olmalı',
          'A def line must look like "def name(p1, p2):"',
        );
      const params = m[2]
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      for (const p of params) {
        if (!/^[A-Za-z_À-￿][\wÀ-￿]*$/.test(p))
          throw unsupported(
            lineNo,
            `Parametre "${p}": varsayılan değer, *args ve tip açıklaması desteklenmiyor`,
            `Parameter "${p}": defaults, *args and annotations are not supported`,
          );
      }
      if (new Set(params).size !== params.length)
        throw syntax(lineNo, 'Aynı parametre adı iki kez kullanılamaz', 'Duplicate parameter name');
      const body: Stmt[] = [];
      let bodyIndent = -1;
      let j = i + 1;
      while (j < lines.length) {
        const r = lines[j];
        if (isBlank(r)) {
          j++;
          continue;
        }
        const ind = indentOf(r);
        if (ind === 0) break;
        if (r.includes('\t'))
          throw unsupported(
            j + 1,
            'Girintide sekme yerine boşluk kullanın',
            'Use spaces instead of tabs for indentation',
          );
        if (bodyIndent === -1) bodyIndent = ind;
        if (ind !== bodyIndent)
          throw unsupported(
            j + 1,
            'İç içe blok desteklenmiyor; fonksiyon gövdesi tek girinti düzeyinde olmalı',
            'Nested blocks are not supported; the function body must use a single indentation level',
          );
        const t = r.trim();
        if (t.startsWith('def '))
          throw unsupported(
            j + 1,
            'İç içe fonksiyon desteklenmiyor',
            'Nested functions are not supported',
          );
        body.push(parseSimple(t, j + 1, true));
        j++;
      }
      if (body.length === 0)
        throw syntax(
          lineNo,
          'Fonksiyon gövdesi boş; girintili en az bir satır gerekir',
          'Function body is empty; at least one indented line is required',
        );
      out.push({ k: 'def', name: m[1], params, body, line: lineNo });
      i = j;
      continue;
    }
    out.push(parseSimple(text, lineNo, false));
    i++;
  }
  return out;
}

/* ------------------------------ Yorumlayıcı ------------------------------ */

interface Obj {
  id: number;
  type: PyType;
  /** int/float/str/bool değeri */
  value?: number | string | boolean | null;
  items?: number[];
  entries?: [number, number][];
  fn?: DefStmt;
  mod?: 'copy' | 'gc';
  cached?: boolean;
}

interface Frame {
  id: number;
  name: string;
  vars: Map<string, number>;
  /** İfade değerlendirilirken oluşan geçici değerler (deyim bitene kadar canlı tutulur) */
  temps: number[];
}

class PyRuntimeError extends Error {
  constructor(
    public pyType: string,
    public detail: string,
  ) {
    super(`${pyType}: ${detail}`);
  }
}

/** Simülatör sınırı (adım/boyut) ya da çalışma anında fark edilen desteklenmeyen kullanım */
class LimitError extends Error {
  constructor(
    public msg: Localized,
    public kind: 'limit' | 'unsupported' = 'limit',
  ) {
    super(msg.en);
  }
}

const MUTABLE: ReadonlySet<PyType> = new Set(['list', 'dict']);

function isIdentifierLike(s: string): boolean {
  return /^[A-Za-z0-9_]*$/.test(s);
}

export function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = '';
  for (const ch of s) {
    if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === quote) out += '\\' + ch;
    else out += ch;
  }
  return quote + out + quote;
}

function floatRepr(v: number): string {
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  if (Number.isInteger(v) && Math.abs(v) < 1e16) return `${v}.0`;
  return String(v);
}

class Interp {
  objs = new Map<number, Obj>();
  nextId = 1;
  frames: Frame[] = [];
  nextFrameId = 1;
  smallInts = new Map<number, number>();
  singletons = new Map<string, number>();
  output: string[] = [];
  steps: PyStep[] = [];
  events: PyEvent[] = [];
  freedNow: { id: number; type: PyType; repr: string }[] = [];
  line = 0;

  constructor() {
    this.frames.push({ id: 0, name: 'global', vars: new Map(), temps: [] });
  }

  get frame(): Frame {
    return this.frames[this.frames.length - 1];
  }

  /* ---- nesne oluşturma ---- */

  alloc(o: Omit<Obj, 'id'>, silent = false): number {
    const id = this.nextId++;
    this.objs.set(id, { ...o, id });
    if (!silent) this.events.push({ kind: 'create', id, type: o.type });
    this.frame.temps.push(id);
    return id;
  }

  /** Değeri geçici olarak canlı tut (deyim bitene kadar) */
  hold(id: number): number {
    this.frame.temps.push(id);
    return id;
  }

  int(v: number): number {
    if (!Number.isSafeInteger(v))
      throw new LimitError({
        tr: 'Sayı çok büyük: bu simülatör yalnızca güvenli tamsayıları destekler',
        en: 'Number too large: only safe integers are supported here',
      });
    if (v >= -5 && v <= 256) {
      const cached = this.smallInts.get(v);
      if (cached !== undefined) {
        this.events.push({ kind: 'reuse', id: cached, reason: 'small-int' });
        return this.hold(cached);
      }
      const id = this.alloc({ type: 'int', value: v, cached: true });
      this.smallInts.set(v, id);
      return id;
    }
    return this.alloc({ type: 'int', value: v });
  }

  float(v: number): number {
    return this.alloc({ type: 'float', value: v });
  }

  str(v: string, literal = false): number {
    if (literal && isIdentifierLike(v)) {
      for (const o of this.objs.values()) {
        if (o.type === 'str' && o.value === v && o.cached !== true && this.isInterned(o)) {
          this.events.push({ kind: 'reuse', id: o.id, reason: 'interned' });
          return this.hold(o.id);
        }
      }
      const id = this.alloc({ type: 'str', value: v });
      this.interned.add(id);
      return id;
    }
    return this.alloc({ type: 'str', value: v });
  }
  interned = new Set<number>();
  isInterned(o: Obj): boolean {
    return this.interned.has(o.id);
  }

  singleton(name: 'True' | 'False' | 'None'): number {
    const existing = this.singletons.get(name);
    if (existing !== undefined) {
      this.events.push({ kind: 'reuse', id: existing, reason: 'singleton' });
      return this.hold(existing);
    }
    const id = this.alloc(
      name === 'None'
        ? { type: 'NoneType', value: null, cached: true }
        : { type: 'bool', value: name === 'True', cached: true },
    );
    this.singletons.set(name, id);
    return id;
  }

  bool(v: boolean): number {
    return this.singleton(v ? 'True' : 'False');
  }

  none(): number {
    return this.singleton('None');
  }

  get(id: number): Obj {
    return this.objs.get(id)!;
  }

  /* ---- gösterim ---- */

  repr(id: number, seen = new Set<number>()): string {
    const o = this.get(id);
    switch (o.type) {
      case 'int':
        return String(o.value);
      case 'float':
        return floatRepr(o.value as number);
      case 'str':
        return pyStrRepr(o.value as string);
      case 'bool':
        return o.value ? 'True' : 'False';
      case 'NoneType':
        return 'None';
      case 'function':
        return `<function ${o.fn!.name}>`;
      case 'module':
        return `<module '${o.mod}'>`;
      default:
        break;
    }
    if (seen.has(id)) return o.type === 'list' ? '[...]' : o.type === 'dict' ? '{...}' : '(...)';
    seen.add(id);
    let out: string;
    if (o.type === 'list') out = `[${o.items!.map((x) => this.repr(x, seen)).join(', ')}]`;
    else if (o.type === 'tuple')
      out =
        o.items!.length === 1
          ? `(${this.repr(o.items![0], seen)},)`
          : `(${o.items!.map((x) => this.repr(x, seen)).join(', ')})`;
    else
      out = `{${o.entries!.map(([k, v]) => `${this.repr(k, seen)}: ${this.repr(v, seen)}`).join(', ')}}`;
    seen.delete(id);
    return out;
  }

  strOf(id: number): string {
    const o = this.get(id);
    return o.type === 'str' ? (o.value as string) : this.repr(id);
  }

  typeName(id: number): string {
    return this.get(id).type;
  }

  /* ---- referans sayımı ve toplama ---- */

  refcounts(): Map<number, number> {
    const rc = new Map<number, number>();
    const inc = (id: number) => rc.set(id, (rc.get(id) ?? 0) + 1);
    for (const f of this.frames) for (const id of f.vars.values()) inc(id);
    for (const o of this.objs.values()) {
      o.items?.forEach(inc);
      o.entries?.forEach(([k, v]) => {
        inc(k);
        inc(v);
      });
    }
    return rc;
  }

  private free(ids: number[], cycle: boolean) {
    for (const id of ids.sort((a, b) => a - b)) {
      const o = this.get(id);
      const repr = this.repr(id);
      this.freedNow.push({ id, type: o.type, repr });
      this.events.push({ kind: 'free', id, type: o.type, repr, cycle });
    }
    for (const id of ids) {
      this.objs.delete(id);
      this.interned.delete(id);
    }
  }

  /** Referans sayısı sıfıra inen nesneleri zincirleme siler (geçici değerler korunur) */
  sweep() {
    const held = new Set(this.frames.flatMap((f) => f.temps));
    for (;;) {
      const rc = this.refcounts();
      const dead = [...this.objs.values()]
        .filter((o) => !o.cached && !held.has(o.id) && (rc.get(o.id) ?? 0) === 0)
        .map((o) => o.id);
      if (dead.length === 0) return;
      this.free(dead, false);
    }
  }

  /** gc.collect(): köklerden (isimler, geçici değerler) erişilemeyen nesneleri (döngüler dahil) siler */
  collectCycles(): number {
    const reach = new Set<number>();
    const stack = this.frames.flatMap((f) => [...f.vars.values(), ...f.temps]);
    while (stack.length) {
      const id = stack.pop()!;
      if (reach.has(id) || !this.objs.has(id)) continue;
      reach.add(id);
      const o = this.get(id);
      o.items?.forEach((x) => stack.push(x));
      o.entries?.forEach(([k, v]) => stack.push(k, v));
    }
    const dead = [...this.objs.values()]
      .filter((o) => !o.cached && !reach.has(o.id))
      .map((o) => o.id);
    if (dead.length) this.free(dead, true);
    this.events.push({ kind: 'gc', freed: dead.length });
    return dead.length;
  }

  /* ---- anlık görüntü ---- */

  snapshot(error?: PyError) {
    if (!error && this.steps.length >= MAX_STEPS)
      throw new LimitError({
        tr: `Adım sınırı (${MAX_STEPS}) aşıldı; programı kısaltın`,
        en: `Step limit (${MAX_STEPS}) exceeded; shorten the program`,
      });
    const rc = this.refcounts();
    const held = new Set(this.frames.flatMap((f) => f.temps));
    const heap: PyObjectView[] = [...this.objs.values()]
      // Önbellekteki (silinmeyen) nesneler yalnızca bir referans varken gösterilir
      .filter((o) => !o.cached || (rc.get(o.id) ?? 0) > 0 || held.has(o.id))
      .map((o) => ({
        id: o.id,
        type: o.type,
        mutable: MUTABLE.has(o.type),
        cached: Boolean(o.cached),
        repr: this.repr(o.id),
        ...(o.items ? { items: [...o.items] } : {}),
        ...(o.entries ? { entries: o.entries.map(([k, v]) => [k, v] as [number, number]) } : {}),
        refcount: rc.get(o.id) ?? 0,
      }));
    this.steps.push({
      line: this.line,
      frames: this.frames.map((f) => ({ id: f.id, name: f.name, vars: [...f.vars.entries()] })),
      heap,
      output: [...this.output],
      events: this.events,
      freed: this.freedNow,
      ...(error ? { error } : {}),
    });
    this.events = [];
    this.freedNow = [];
  }

  /* ---- isimler ---- */

  lookup(name: string): number {
    const local = this.frame.vars.get(name);
    if (local !== undefined) return this.hold(local);
    const global = this.frames[0].vars.get(name);
    if (global !== undefined) return this.hold(global);
    if (BUILTINS.has(name))
      throw new LimitError(
        {
          tr: `'${name}' bu simülatörde yalnızca çağrı olarak kullanılabilir: ${name}(…)`,
          en: `'${name}' can only be used as a call in this simulator: ${name}(…)`,
        },
        'unsupported',
      );
    throw new PyRuntimeError('NameError', `name '${name}' is not defined`);
  }

  bind(name: string, id: number) {
    this.frame.vars.set(name, id);
    this.events.push({ kind: 'bind', frame: this.frame.name, name, id });
  }

  /* ---- yardımcılar ---- */

  num(id: number): number | null {
    const o = this.get(id);
    if (o.type === 'int' || o.type === 'float') return o.value as number;
    if (o.type === 'bool') return o.value ? 1 : 0;
    return null;
  }

  isFloat(id: number) {
    return this.get(id).type === 'float';
  }

  makeNumber(v: number, float: boolean): number {
    return float ? this.float(v) : this.int(v);
  }

  eq(a: number, b: number, seen = new Set<string>()): boolean {
    if (a === b) return true;
    const x = this.get(a);
    const y = this.get(b);
    const nx = this.num(a);
    const ny = this.num(b);
    if (nx !== null && ny !== null) return nx === ny;
    if (x.type !== y.type) return false;
    if (x.type === 'str') return x.value === y.value;
    const key = `${a}:${b}`;
    if (seen.has(key)) return true;
    seen.add(key);
    if (x.items && y.items)
      return (
        x.items.length === y.items.length && x.items.every((v, i) => this.eq(v, y.items![i], seen))
      );
    if (x.entries && y.entries)
      return (
        x.entries.length === y.entries.length &&
        x.entries.every(([k, v]) => {
          const other = y.entries!.find(([k2]) => this.eq(k, k2, seen));
          return other !== undefined && this.eq(v, other[1], seen);
        })
      );
    return x.type === 'NoneType';
  }

  hashable(id: number): boolean {
    const o = this.get(id);
    if (o.type === 'list' || o.type === 'dict') return false;
    if (o.type === 'tuple') return o.items!.every((x) => this.hashable(x));
    return true;
  }

  index(obj: Obj, idx: number): number {
    const n = this.num(idx);
    if (n === null || this.isFloat(idx))
      throw new PyRuntimeError(
        'TypeError',
        `${obj.type} indices must be integers, not ${this.typeName(idx)}`,
      );
    const len = obj.type === 'str' ? [...(obj.value as string)].length : obj.items!.length;
    const i = n < 0 ? len + n : n;
    if (i < 0 || i >= len) throw new PyRuntimeError('IndexError', `${obj.type} index out of range`);
    return i;
  }

  dictFind(o: Obj, key: number): number {
    if (!this.hashable(key))
      throw new PyRuntimeError('TypeError', `unhashable type: '${this.typeName(key)}'`);
    return o.entries!.findIndex(([k]) => this.eq(k, key));
  }

  shallowCopy(id: number): number {
    const o = this.get(id);
    if (o.type === 'list') return this.alloc({ type: 'list', items: [...o.items!] });
    if (o.type === 'dict')
      return this.alloc({ type: 'dict', entries: o.entries!.map(([k, v]) => [k, v]) });
    return this.hold(id);
  }

  deepCopy(id: number, memo = new Map<number, number>()): number {
    const done = memo.get(id);
    if (done !== undefined) return done;
    const o = this.get(id);
    if (o.type === 'list') {
      const nid = this.alloc({ type: 'list', items: [] });
      memo.set(id, nid);
      this.get(nid).items = o.items!.map((x) => this.deepCopy(x, memo));
      return nid;
    }
    if (o.type === 'dict') {
      const nid = this.alloc({ type: 'dict', entries: [] });
      memo.set(id, nid);
      this.get(nid).entries = o.entries!.map(([k, v]) => [
        this.deepCopy(k, memo),
        this.deepCopy(v, memo),
      ]);
      return nid;
    }
    if (o.type === 'tuple') {
      const items = o.items!.map((x) => this.deepCopy(x, memo));
      // Elemanların hiçbiri kopyalanmadıysa tuple'ın kendisi döner (CPython davranışı)
      if (items.every((x, i) => x === o.items![i])) return id;
      const nid = this.alloc({ type: 'tuple', items });
      memo.set(id, nid);
      return nid;
    }
    return id;
  }

  /* ---- ifadeler ---- */

  eval(e: Expr): number {
    switch (e.k) {
      case 'num':
        return e.float ? this.float(e.v) : this.int(e.v);
      case 'str':
        return this.str(e.v, true);
      case 'const':
        return this.singleton(e.v);
      case 'name':
        return this.lookup(e.name);
      case 'list': {
        const items = e.items.map((x) => this.eval(x));
        return this.alloc({ type: 'list', items });
      }
      case 'tuple': {
        const items = e.items.map((x) => this.eval(x));
        return this.alloc({ type: 'tuple', items });
      }
      case 'dict': {
        const id = this.alloc({ type: 'dict', entries: [] });
        const d = this.get(id);
        for (const [ke, ve] of e.entries) {
          const k = this.eval(ke);
          const v = this.eval(ve);
          const at = this.dictFind(d, k);
          if (at >= 0) d.entries![at][1] = v;
          else d.entries!.push([k, v]);
        }
        return id;
      }
      case 'neg': {
        const v = this.eval(e.e);
        const n = this.num(v);
        if (n === null)
          throw new PyRuntimeError(
            'TypeError',
            `bad operand type for unary -: '${this.typeName(v)}'`,
          );
        return this.makeNumber(-n, this.isFloat(v));
      }
      case 'bin':
        return this.binary(e.op, this.eval(e.l), this.eval(e.r));
      case 'cmp':
        return this.compare(e.op, this.eval(e.l), this.eval(e.r));
      case 'sub': {
        const objId = this.eval(e.obj);
        const idx = this.eval(e.index);
        const o = this.get(objId);
        if (o.type === 'list' || o.type === 'tuple') return this.hold(o.items![this.index(o, idx)]);
        if (o.type === 'str') return this.str([...(o.value as string)][this.index(o, idx)], true);
        if (o.type === 'dict') {
          const at = this.dictFind(o, idx);
          if (at < 0) throw new PyRuntimeError('KeyError', this.repr(idx));
          return this.hold(o.entries![at][1]);
        }
        throw new PyRuntimeError('TypeError', `'${o.type}' object is not subscriptable`);
      }
      case 'slice': {
        const objId = this.eval(e.obj);
        const o = this.get(objId);
        if (o.type === 'list') return this.alloc({ type: 'list', items: [...o.items!] });
        // Değiştirilemez dizinin tam dilimi nesnenin kendisidir
        if (o.type === 'tuple' || o.type === 'str') return objId;
        throw new PyRuntimeError('TypeError', `'${o.type}' object is not subscriptable`);
      }
      case 'attr':
        throw new PyRuntimeError('AttributeError', e.name);
      case 'call':
        return this.call(e);
    }
  }

  binary(op: string, a: number, b: number): number {
    const x = this.get(a);
    const y = this.get(b);
    const na = this.num(a);
    const nb = this.num(b);
    const opName = op === '+' ? '+' : op;
    if (na !== null && nb !== null) {
      const float = this.isFloat(a) || this.isFloat(b);
      if ((op === '//' || op === '%') && nb === 0)
        throw new PyRuntimeError(
          'ZeroDivisionError',
          float ? 'float division by zero' : 'integer division or modulo by zero',
        );
      const r =
        op === '+'
          ? na + nb
          : op === '-'
            ? na - nb
            : op === '*'
              ? na * nb
              : op === '//'
                ? Math.floor(na / nb)
                : na - nb * Math.floor(na / nb);
      return this.makeNumber(r, float);
    }
    if (op === '+') {
      if (x.type === 'str' && y.type === 'str')
        return this.str((x.value as string) + (y.value as string));
      if (x.type === 'list' && y.type === 'list')
        return this.alloc({ type: 'list', items: [...x.items!, ...y.items!] });
      if (x.type === 'tuple' && y.type === 'tuple')
        return this.alloc({ type: 'tuple', items: [...x.items!, ...y.items!] });
      if (x.type === 'list' || x.type === 'tuple' || x.type === 'str')
        throw new PyRuntimeError(
          'TypeError',
          `can only concatenate ${x.type} (not "${y.type}") to ${x.type}`,
        );
    }
    if (op === '*') {
      const [seq, times] =
        nb !== null && !this.isFloat(b)
          ? [x, nb]
          : na !== null && !this.isFloat(a)
            ? [y, na]
            : [null, 0];
      if (seq && (seq.type === 'list' || seq.type === 'tuple')) {
        const n = Math.max(0, times);
        if (seq.items!.length * n > 200)
          throw new LimitError({
            tr: 'Çok büyük liste: en fazla 200 eleman',
            en: 'List too large: at most 200 items',
          });
        const items: number[] = [];
        for (let i = 0; i < n; i++) items.push(...seq.items!);
        return this.alloc({ type: seq.type, items });
      }
      if (seq && seq.type === 'str')
        return this.str((seq.value as string).repeat(Math.max(0, Math.min(times, 200))));
    }
    throw new PyRuntimeError(
      'TypeError',
      `unsupported operand type(s) for ${opName}: '${x.type}' and '${y.type}'`,
    );
  }

  compare(op: string, a: number, b: number): number {
    if (op === 'is') return this.bool(a === b);
    if (op === 'is not') return this.bool(a !== b);
    if (op === '==') return this.bool(this.eq(a, b));
    if (op === '!=') return this.bool(!this.eq(a, b));
    const na = this.num(a);
    const nb = this.num(b);
    const x = this.get(a);
    const y = this.get(b);
    let l: number | string;
    let r: number | string;
    if (na !== null && nb !== null) [l, r] = [na, nb];
    else if (x.type === 'str' && y.type === 'str') [l, r] = [x.value as string, y.value as string];
    else
      throw new PyRuntimeError(
        'TypeError',
        `'${op}' not supported between instances of '${x.type}' and '${y.type}'`,
      );
    const res = op === '<' ? l < r : op === '>' ? l > r : op === '<=' ? l <= r : l >= r;
    return this.bool(res);
  }

  call(e: Extract<Expr, { k: 'call' }>): number {
    if (e.fn.k === 'attr') {
      const objId = this.eval(e.fn.obj);
      const o = this.get(objId);
      const args = e.args.map((x) => this.eval(x));
      return this.method(o, e.fn.name, args);
    }
    const name = (e.fn as { name: string }).name;
    const local = this.frame.vars.get(name) ?? this.frames[0].vars.get(name);
    if (local === undefined && BUILTINS.has(name)) {
      const args = e.args.map((x) => this.eval(x));
      return this.builtin(name, args);
    }
    const fnId = this.lookup(name);
    const args = e.args.map((x) => this.eval(x));
    const fo = this.get(fnId);
    if (fo.type !== 'function')
      throw new PyRuntimeError('TypeError', `'${fo.type}' object is not callable`);
    return this.invoke(fo.fn!, args);
  }

  argc(name: string, args: number[], min: number, max = min) {
    if (args.length < min || args.length > max)
      throw new PyRuntimeError(
        'TypeError',
        min === max
          ? `${name}() takes exactly ${min} argument${min === 1 ? '' : 's'} (${args.length} given)`
          : `${name}() takes ${min} to ${max} arguments (${args.length} given)`,
      );
  }

  builtin(name: string, args: number[]): number {
    switch (name) {
      case 'print': {
        const text = args.map((a) => this.strOf(a)).join(' ');
        this.output.push(text);
        this.events.push({ kind: 'print', text });
        return this.none();
      }
      case 'len': {
        this.argc('len', args, 1);
        const o = this.get(args[0]);
        if (o.type === 'str') return this.int([...(o.value as string)].length);
        if (o.items) return this.int(o.items.length);
        if (o.entries) return this.int(o.entries.length);
        throw new PyRuntimeError('TypeError', `object of type '${o.type}' has no len()`);
      }
      case 'id':
        this.argc('id', args, 1);
        return this.int(args[0]);
      case 'list':
      case 'tuple': {
        this.argc(name, args, 0, 1);
        if (args.length === 0) return this.alloc({ type: name, items: [] });
        const o = this.get(args[0]);
        if (name === 'tuple' && o.type === 'tuple') return args[0];
        let items: number[];
        if (o.items) items = [...o.items];
        else if (o.entries) items = o.entries.map(([k]) => k);
        else if (o.type === 'str') items = [...(o.value as string)].map((ch) => this.str(ch, true));
        else throw new PyRuntimeError('TypeError', `'${o.type}' object is not iterable`);
        return this.alloc({ type: name, items });
      }
      default:
        throw new PyRuntimeError('NameError', `name '${name}' is not defined`);
    }
  }

  method(o: Obj, m: string, args: number[]): number {
    if (o.type === 'module') {
      if (o.mod === 'copy' && (m === 'copy' || m === 'deepcopy')) {
        this.argc(m, args, 1);
        return m === 'copy' ? this.shallowCopy(args[0]) : this.deepCopy(args[0]);
      }
      if (o.mod === 'gc' && m === 'collect') {
        this.argc('collect', args, 0);
        // Bu deyimin geçici değerleri dışındaki çöpü topla
        this.sweep();
        return this.int(this.collectCycles());
      }
      throw new PyRuntimeError('AttributeError', `module '${o.mod}' has no attribute '${m}'`);
    }
    if (o.type === 'list' && LIST_METHODS.has(m)) {
      const items = o.items!;
      switch (m) {
        case 'append':
          this.argc('append', args, 1);
          items.push(args[0]);
          break;
        case 'extend': {
          this.argc('extend', args, 1);
          const src = this.get(args[0]);
          if (src.items) items.push(...src.items);
          else if (src.entries) items.push(...src.entries.map(([k]) => k));
          else if (src.type === 'str')
            items.push(...[...(src.value as string)].map((ch) => this.str(ch, true)));
          else throw new PyRuntimeError('TypeError', `'${src.type}' object is not iterable`);
          break;
        }
        case 'insert': {
          this.argc('insert', args, 2);
          const n = this.num(args[0]);
          if (n === null || this.isFloat(args[0]))
            throw new PyRuntimeError(
              'TypeError',
              "'float' object cannot be interpreted as an integer",
            );
          const at = n < 0 ? Math.max(0, items.length + n) : Math.min(items.length, n);
          items.splice(at, 0, args[1]);
          break;
        }
        case 'pop': {
          this.argc('pop', args, 0, 1);
          if (items.length === 0) throw new PyRuntimeError('IndexError', 'pop from empty list');
          const at = args.length ? this.index(o, args[0]) : items.length - 1;
          const [removed] = items.splice(at, 1);
          this.events.push({ kind: 'mutate', id: o.id });
          return this.hold(removed);
        }
        case 'remove': {
          this.argc('remove', args, 1);
          const at = items.findIndex((x) => this.eq(x, args[0]));
          if (at < 0) throw new PyRuntimeError('ValueError', 'list.remove(x): x not in list');
          items.splice(at, 1);
          break;
        }
        case 'clear':
          this.argc('clear', args, 0);
          items.length = 0;
          break;
        case 'copy':
          this.argc('copy', args, 0);
          return this.shallowCopy(o.id);
      }
      this.events.push({ kind: 'mutate', id: o.id });
      return this.none();
    }
    if (o.type === 'dict' && DICT_METHODS.has(m)) {
      this.argc('copy', args, 0);
      return this.shallowCopy(o.id);
    }
    throw new PyRuntimeError('AttributeError', `'${o.type}' object has no attribute '${m}'`);
  }

  invoke(fn: DefStmt, args: number[]): number {
    if (args.length !== fn.params.length)
      throw new PyRuntimeError(
        'TypeError',
        `${fn.name}() takes ${fn.params.length} positional argument${fn.params.length === 1 ? '' : 's'} but ${args.length} ${args.length === 1 ? 'was' : 'were'} given`,
      );
    if (this.frames.length >= MAX_DEPTH)
      throw new PyRuntimeError('RecursionError', 'maximum recursion depth exceeded');
    const callerLine = this.line;
    this.frames.push({ id: this.nextFrameId++, name: fn.name, vars: new Map(), temps: [] });
    this.events.push({ kind: 'call', fn: fn.name });
    fn.params.forEach((p, i) => this.bind(p, args[i]));
    this.line = fn.line;
    this.snapshot();
    let result: number | undefined;
    for (const st of fn.body) {
      if (st.k === 'return') {
        this.line = st.line;
        result = st.e ? this.eval(st.e) : this.none();
        this.events.push({ kind: 'return', fn: fn.name, id: result });
        this.snapshot();
        break;
      }
      this.exec(st);
      this.frame.temps = [];
      this.sweep();
      this.snapshot();
    }
    if (result === undefined) {
      result = this.none();
      this.events.push({ kind: 'return', fn: fn.name, id: result });
    }
    this.frames.pop();
    this.line = callerLine;
    this.hold(result);
    // Çerçeve kapandı: yerel isimlerin tuttuğu nesneler sahipsiz kalabilir
    this.sweep();
    return result;
  }

  /* ---- deyimler ---- */

  assign(target: Target, value: number) {
    if (target.k === 'name') {
      this.bind(target.name, value);
      return;
    }
    const objId = this.eval(target.obj);
    const idx = this.eval(target.index);
    const o = this.get(objId);
    if (o.type === 'list') {
      o.items![this.index(o, idx)] = value;
    } else if (o.type === 'dict') {
      const at = this.dictFind(o, idx);
      if (at >= 0) o.entries![at][1] = value;
      else o.entries!.push([idx, value]);
    } else {
      throw new PyRuntimeError('TypeError', `'${o.type}' object does not support item assignment`);
    }
    this.events.push({ kind: 'mutate', id: o.id });
  }

  exec(st: Stmt) {
    this.line = st.line;
    switch (st.k) {
      case 'pass':
        return;
      case 'import': {
        const id = this.alloc({ type: 'module', mod: st.mod });
        this.bind(st.mod, id);
        return;
      }
      case 'def': {
        const id = this.alloc({ type: 'function', fn: st });
        this.bind(st.name, id);
        return;
      }
      case 'expr': {
        const v = this.eval(st.e);
        // REPL davranışı: üst düzeyde None olmayan değer yazdırılır
        if (this.frames.length === 1 && this.get(v).type !== 'NoneType') {
          const text = this.repr(v);
          this.output.push(text);
          this.events.push({ kind: 'print', text });
        }
        return;
      }
      case 'assign': {
        const v = this.eval(st.e);
        this.assign(st.target, v);
        return;
      }
      case 'aug': {
        const current =
          st.target.k === 'name'
            ? this.lookup(st.target.name)
            : this.eval({ k: 'sub', obj: st.target.obj, index: st.target.index });
        const rhs = this.eval(st.e);
        const o = this.get(current);
        // Liste += yerinde genişletir (aynı nesne), *= yerinde çoğaltır; diğerleri yeni nesne üretir
        if (o.type === 'list' && st.op === '+') {
          this.method(o, 'extend', [rhs]);
          this.assign(st.target, current);
          return;
        }
        const v = this.binary(st.op, current, rhs);
        if (o.type === 'list' && st.op === '*') {
          o.items = [...this.get(v).items!];
          this.events.push({ kind: 'mutate', id: o.id });
          this.assign(st.target, current);
          return;
        }
        this.assign(st.target, v);
        return;
      }
      case 'del': {
        for (const t of st.targets) {
          if (t.k === 'name') {
            if (!this.frame.vars.has(t.name)) {
              throw new PyRuntimeError('NameError', `name '${t.name}' is not defined`);
            }
            this.frame.vars.delete(t.name);
            this.events.push({ kind: 'unbind', frame: this.frame.name, name: t.name });
            continue;
          }
          const objId = this.eval(t.obj);
          const idx = this.eval(t.index);
          const o = this.get(objId);
          if (o.type === 'list') o.items!.splice(this.index(o, idx), 1);
          else if (o.type === 'dict') {
            const at = this.dictFind(o, idx);
            if (at < 0) throw new PyRuntimeError('KeyError', this.repr(idx));
            o.entries!.splice(at, 1);
          } else
            throw new PyRuntimeError(
              'TypeError',
              `'${o.type}' object doesn't support item deletion`,
            );
          this.events.push({ kind: 'mutate', id: o.id });
        }
        return;
      }
      case 'return':
        return;
    }
  }

  run(program: Stmt[]): PyRun {
    this.snapshot();
    try {
      for (const st of program) {
        this.exec(st);
        this.frames[0].temps = [];
        this.sweep();
        this.snapshot();
      }
      return { steps: this.steps };
    } catch (err) {
      let error: PyError;
      if (err instanceof PyRuntimeError) {
        const text = `${err.pyType}: ${err.detail}`;
        error = { line: this.line, kind: 'runtime', message: { tr: text, en: text } };
      } else if (err instanceof LimitError) {
        error = { line: this.line, kind: err.kind, message: err.msg };
      } else {
        throw err;
      }
      // Hata anındaki çerçeveler korunur (Traceback'teki yığın)
      for (const f of this.frames) f.temps = [];
      this.snapshot(error);
      return { steps: this.steps, error };
    }
  }
}

/** Kaynağı ayrıştırır ve çalıştırır; her deyimden sonraki bellek görüntüsünü döndürür */
export function runPython(src: string): PyRun {
  let program: Stmt[];
  try {
    program = parseProgram(src);
  } catch (err) {
    if (err instanceof ParseError)
      return { steps: [], error: { line: err.line, kind: err.kind, message: err.msg } };
    throw err;
  }
  return new Interp().run(program);
}
