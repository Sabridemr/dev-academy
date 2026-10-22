/**
 * Yetkilendirme politika değerlendiricisinin saf mantığı: RBAC (rol → izin matrisi) ve ABAC
 * (öznitelik koşullu kurallar). ABAC kuralları küçük bir ifade diliyle yazılır:
 *
 *   user.department == resource.department AND action in [read, write]
 *   resource.sensitivity == confidential AND user.level < 2
 *   NOT (resource.id in user.owns) OR action == read
 *
 * Desteklenenler: AND / OR / NOT, parantez, == != < <= > >=, `in [liste]`, `in user.owns` gibi liste
 * öznitelikleri, tırnaklı ya da tırnaksız metin, sayı. Bilinmeyen öznitelik `tanımsız` olur ve her
 * karşılaştırma yanlış döner (güvenli taraf: bilinmeyen = izin yok).
 */

export type Bi = { tr: string; en: string };

export const ACTIONS = ['read', 'write', 'delete', 'approve'] as const;
export type Action = (typeof ACTIONS)[number];

export const ROLES = ['viewer', 'editor', 'manager', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export type Sensitivity = 'public' | 'internal' | 'confidential';

export interface User {
  id: string;
  name: string;
  role: Role;
  department: string;
  level: number;
  /** Sahip olduğu kaynakların kimlikleri */
  owns: string[];
}

export interface Resource {
  id: string;
  name: Bi;
  type: 'document' | 'invoice' | 'report';
  owner: string;
  department: string;
  sensitivity: Sensitivity;
}

export const USERS: User[] = [
  {
    id: 'ayse',
    name: 'Ayşe',
    role: 'manager',
    department: 'finance',
    level: 3,
    owns: ['inv-1043'],
  },
  {
    id: 'mehmet',
    name: 'Mehmet',
    role: 'editor',
    department: 'sales',
    level: 2,
    owns: ['doc-offer'],
  },
  { id: 'zeynep', name: 'Zeynep', role: 'viewer', department: 'sales', level: 1, owns: [] },
  { id: 'can', name: 'Can', role: 'viewer', department: 'finance', level: 1, owns: [] },
  {
    id: 'elif',
    name: 'Elif',
    role: 'admin',
    department: 'it',
    level: 4,
    owns: ['rep-q3', 'doc-notice'],
  },
];

export const RESOURCES: Resource[] = [
  {
    id: 'doc-offer',
    name: { tr: 'Satış teklifi', en: 'Sales offer' },
    type: 'document',
    owner: 'mehmet',
    department: 'sales',
    sensitivity: 'internal',
  },
  {
    id: 'inv-1043',
    name: { tr: 'Fatura #1043', en: 'Invoice #1043' },
    type: 'invoice',
    owner: 'ayse',
    department: 'finance',
    sensitivity: 'confidential',
  },
  {
    id: 'rep-q3',
    name: { tr: 'Çeyrek raporu', en: 'Quarterly report' },
    type: 'report',
    owner: 'elif',
    department: 'finance',
    sensitivity: 'internal',
  },
  {
    id: 'doc-notice',
    name: { tr: 'Şirket duyurusu', en: 'Company notice' },
    type: 'document',
    owner: 'elif',
    department: 'it',
    sensitivity: 'public',
  },
];

/* ------------------------------------------------------------------ RBAC */

export type RbacMatrix = Record<Role, Record<Action, boolean>>;

const row = (...allowed: Action[]): Record<Action, boolean> =>
  Object.fromEntries(ACTIONS.map((a) => [a, allowed.includes(a)])) as Record<Action, boolean>;

export function defaultMatrix(): RbacMatrix {
  return {
    viewer: row('read'),
    editor: row('read', 'write'),
    manager: row('read', 'write', 'approve'),
    admin: row('read', 'write', 'delete', 'approve'),
  };
}

/** Ayrıcalık yükseltme senaryosu (RBAC): "geçici" olarak viewer rolüne silme izni verilmiş */
export function escalatedMatrix(): RbacMatrix {
  const m = defaultMatrix();
  m.viewer = { ...m.viewer, delete: true };
  return m;
}

export function toggleMatrix(m: RbacMatrix, role: Role, action: Action): RbacMatrix {
  return { ...m, [role]: { ...m[role], [action]: !m[role][action] } };
}

/* ------------------------------------------------------------------ ABAC ifade dili */

export type Value = string | number | boolean | string[] | undefined;

type Tok =
  | { t: 'id'; v: string }
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'op'; v: CmpOp }
  | { t: 'and' | 'or' | 'not' | 'in' | '(' | ')' | '[' | ']' | ',' };

export type CmpOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in';

export type Operand =
  | { kind: 'path'; path: string }
  | { kind: 'lit'; value: string | number | boolean }
  | { kind: 'list'; items: (string | number)[] };

export type Expr =
  | { kind: 'and' | 'or'; left: Expr; right: Expr }
  | { kind: 'not'; expr: Expr }
  | { kind: 'cmp'; op: CmpOp; left: Operand; right: Operand }
  | { kind: 'bool'; value: boolean };

export class PolicyParseError extends Error {}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>='].includes(two)) {
      out.push({ t: 'op', v: two as CmpOp });
      i += 2;
      continue;
    }
    if (two === '&&' || two === '||') {
      out.push({ t: two === '&&' ? 'and' : 'or' });
      i += 2;
      continue;
    }
    if (c === '<' || c === '>') {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '!') {
      out.push({ t: 'not' });
      i++;
      continue;
    }
    if ('()[],'.includes(c)) {
      out.push({ t: c as '(' | ')' | '[' | ']' | ',' });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new PolicyParseError(`kapanmayan tırnak (${i + 1}. karakter)`);
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][\w.-]*/.exec(src.slice(i));
    if (id) {
      const w = id[0];
      const lw = w.toLowerCase();
      if (lw === 'and' || lw === 'or' || lw === 'not' || lw === 'in') out.push({ t: lw });
      else out.push({ t: 'id', v: w });
      i += w.length;
      continue;
    }
    throw new PolicyParseError(`beklenmeyen karakter “${c}” (${i + 1}. karakter)`);
  }
  return out;
}

const PATH_RE = /^(user|resource)\.[A-Za-z_]\w*$|^action$/;

/** Kural koşulunu ayrıştırır; hatalıysa PolicyParseError fırlatır */
export function parseCondition(src: string): Expr {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (t: Tok['t']) => {
    const k = toks[p];
    if (!k || k.t !== t) throw new PolicyParseError(`“${t}” bekleniyordu`);
    p++;
    return k;
  };

  const operand = (): Operand => {
    const k = toks[p++];
    if (!k) throw new PolicyParseError('ifade yarım kaldı');
    if (k.t === '[') {
      const items: (string | number)[] = [];
      while (peek() && peek().t !== ']') {
        const it = toks[p++];
        if (it.t === 'id' || it.t === 'str') items.push(it.v);
        else if (it.t === 'num') items.push(it.v);
        else throw new PolicyParseError('liste içinde geçersiz öğe');
        if (peek()?.t === ',') p++;
      }
      eat(']');
      return { kind: 'list', items };
    }
    if (k.t === 'str') return { kind: 'lit', value: k.v };
    if (k.t === 'num') return { kind: 'lit', value: k.v };
    if (k.t === 'id') {
      if (k.v === 'true' || k.v === 'false') return { kind: 'lit', value: k.v === 'true' };
      if (PATH_RE.test(k.v)) return { kind: 'path', path: k.v };
      if (k.v.includes('.'))
        throw new PolicyParseError(`bilinmeyen öznitelik kökü: ${k.v} (user. ya da resource.)`);
      // tırnaksız kelime metin sabitidir: finance, read, confidential…
      return { kind: 'lit', value: k.v };
    }
    throw new PolicyParseError('değer bekleniyordu');
  };

  const primary = (): Expr => {
    const k = peek();
    if (!k) throw new PolicyParseError('ifade boş');
    if (k.t === 'not') {
      p++;
      return { kind: 'not', expr: primary() };
    }
    if (k.t === '(') {
      p++;
      const e = or();
      eat(')');
      return e;
    }
    const left = operand();
    const op = peek();
    if (op && (op.t === 'op' || op.t === 'in')) {
      p++;
      const right = operand();
      return { kind: 'cmp', op: op.t === 'op' ? op.v : 'in', left, right };
    }
    if (left.kind === 'lit' && typeof left.value === 'boolean')
      return { kind: 'bool', value: left.value };
    throw new PolicyParseError('karşılaştırma işleci (==, !=, <, in…) bekleniyordu');
  };
  const and = (): Expr => {
    let e = primary();
    while (peek()?.t === 'and') {
      p++;
      e = { kind: 'and', left: e, right: primary() };
    }
    return e;
  };
  function or(): Expr {
    let e = and();
    while (peek()?.t === 'or') {
      p++;
      e = { kind: 'or', left: e, right: and() };
    }
    return e;
  }

  const e = or();
  if (p < toks.length) throw new PolicyParseError('ifadenin sonunda fazladan parça var');
  return e;
}

export interface EvalContext {
  user: User;
  resource: Resource;
  action: Action;
}

export function resolvePath(path: string, ctx: EvalContext): Value {
  if (path === 'action') return ctx.action;
  const [root, key] = path.split('.');
  const obj = (root === 'user' ? ctx.user : ctx.resource) as unknown as Record<string, unknown>;
  const v = obj[key];
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v && typeof v === 'object' && 'tr' in v) return (v as Bi).en;
  if (Array.isArray(v)) return v.map(String);
  return undefined;
}

const SENSITIVITY_RANK: Record<string, number> = { public: 0, internal: 1, confidential: 2 };

function operandValue(o: Operand, ctx: EvalContext): Value {
  if (o.kind === 'path') return resolvePath(o.path, ctx);
  if (o.kind === 'list') return o.items.map(String);
  return o.value;
}

export function fmtValue(v: Value): string {
  if (v === undefined) return '∅';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
}

function operandText(o: Operand): string {
  if (o.kind === 'path') return o.path;
  if (o.kind === 'list') return `[${o.items.join(', ')}]`;
  return String(o.value);
}

function compare(op: CmpOp, a: Value, b: Value): boolean {
  if (a === undefined || b === undefined) return false;
  if (op === 'in') {
    if (!Array.isArray(b)) return false;
    return !Array.isArray(a) && b.includes(String(a));
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return op === '==' ? fmtValue(a) === fmtValue(b) : op === '!=' && fmtValue(a) !== fmtValue(b);
  }
  if (op === '==') return String(a) === String(b);
  if (op === '!=') return String(a) !== String(b);
  // Sıralama: sayılar sayı olarak; hassasiyet seviyeleri kendi sırasıyla
  const na = typeof a === 'number' ? a : (SENSITIVITY_RANK[String(a)] ?? Number(a));
  const nb = typeof b === 'number' ? b : (SENSITIVITY_RANK[String(b)] ?? Number(b));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return op === '<' ? na < nb : op === '<=' ? na <= nb : op === '>' ? na > nb : na >= nb;
}

export interface Comparison {
  text: string;
  result: boolean;
}

/** İfadeyi değerlendirir; her karşılaştırmayı (değerleriyle) iz listesine yazar */
export function evalExpr(e: Expr, ctx: EvalContext, trace: Comparison[] = []): boolean {
  switch (e.kind) {
    case 'bool':
      return e.value;
    case 'not':
      return !evalExpr(e.expr, ctx, trace);
    case 'and': {
      const l = evalExpr(e.left, ctx, trace);
      const r = evalExpr(e.right, ctx, trace);
      return l && r;
    }
    case 'or': {
      const l = evalExpr(e.left, ctx, trace);
      const r = evalExpr(e.right, ctx, trace);
      return l || r;
    }
    case 'cmp': {
      const a = operandValue(e.left, ctx);
      const b = operandValue(e.right, ctx);
      const result = compare(e.op, a, b);
      const show = (o: Operand, v: Value) =>
        o.kind === 'path' ? `${operandText(o)} (${fmtValue(v)})` : operandText(o);
      trace.push({ text: `${show(e.left, a)} ${e.op} ${show(e.right, b)}`, result });
      return result;
    }
  }
}

/* ------------------------------------------------------------------ ABAC kurallar */

export type Effect = 'allow' | 'deny';

export interface Rule {
  id: string;
  effect: Effect;
  condition: string;
  note?: Bi;
}

export type Combining = 'deny-overrides' | 'first-applicable';

export function defaultRules(): Rule[] {
  return [
    {
      id: 'r1',
      effect: 'allow',
      condition: 'resource.sensitivity == public AND action == read',
      note: { tr: 'Herkese açık belgeyi herkes okur', en: 'Anyone may read public documents' },
    },
    {
      id: 'r2',
      effect: 'allow',
      condition: 'user.department == resource.department AND action in [read]',
      note: { tr: 'Kendi departmanının kaynaklarını okur', en: 'Read resources of own department' },
    },
    {
      id: 'r3',
      effect: 'allow',
      condition: 'resource.id in user.owns AND action in [read, write, delete]',
      note: { tr: 'Sahibi kendi kaynağını yönetir', en: 'Owners manage their own resources' },
    },
    {
      id: 'r4',
      effect: 'allow',
      condition:
        'user.role == manager AND user.department == resource.department AND action == approve',
      note: {
        tr: 'Yönetici kendi departmanında onaylar',
        en: 'Managers approve in their department',
      },
    },
    {
      id: 'r5',
      effect: 'deny',
      condition: 'resource.sensitivity == confidential AND user.level < 2',
      note: {
        tr: 'Gizli veri, seviye 2 altına kapalı',
        en: 'Confidential data closed below level 2',
      },
    },
    {
      id: 'r6',
      effect: 'allow',
      condition: 'user.role == admin',
      note: { tr: 'Yönetici (admin) her şeyi yapar', en: 'Admins can do everything' },
    },
  ];
}

/**
 * Ayrıcalık yükseltme senaryosu (ABAC): r2'ye yazma eklenirken AND yanlışlıkla OR yazılmış.
 * Artık her kullanıcı, departmanı ne olursa olsun her kaynağı okuyup yazabilir.
 */
export function escalatedRules(): Rule[] {
  return defaultRules().map((r) =>
    r.id === 'r2'
      ? { ...r, condition: 'user.department == resource.department OR action in [read, write]' }
      : r,
  );
}

export type Scenario = 'baseline' | 'escalation';

/** Senaryonun önerdiği örnek üçlü: yükseltmeyi doğrudan gösterir */
export const ESCALATION_PROBE: Record<
  'rbac' | 'abac',
  { user: string; action: Action; resource: string }
> = {
  rbac: { user: 'can', action: 'delete', resource: 'inv-1043' },
  abac: { user: 'zeynep', action: 'write', resource: 'rep-q3' },
};

export interface Step {
  kind: 'info' | 'match' | 'skip' | 'error' | 'decision';
  text: Bi;
  ruleId?: string;
  comparisons?: Comparison[];
}

export interface Decision {
  allowed: boolean;
  reason: 'rbac-allow' | 'rbac-deny' | 'explicit-deny' | 'allow-rule' | 'default-deny';
  ruleId?: string;
  steps: Step[];
}

export function evaluateRbac(
  user: User,
  action: Action,
  resource: Resource,
  matrix: RbacMatrix,
): Decision {
  const allowed = matrix[user.role][action];
  const steps: Step[] = [
    {
      kind: 'info',
      text: {
        tr: `${user.name} kullanıcısının rolü: ${user.role}`,
        en: `${user.name}'s role: ${user.role}`,
      },
    },
    {
      kind: allowed ? 'match' : 'skip',
      text: {
        tr: `Matriste ${user.role} × ${action} = ${allowed ? '✓ izinli' : '✗ yok'}`,
        en: `Matrix ${user.role} × ${action} = ${allowed ? '✓ granted' : '✗ not granted'}`,
      },
    },
    {
      kind: 'info',
      text: {
        tr: `RBAC kaynağın sahibine (${resource.owner}), departmanına (${resource.department}) ve hassasiyetine (${resource.sensitivity}) bakmaz.`,
        en: `RBAC ignores the resource owner (${resource.owner}), department (${resource.department}) and sensitivity (${resource.sensitivity}).`,
      },
    },
  ];
  steps.push({
    kind: 'decision',
    text: allowed
      ? {
          tr: 'Karar: İZİN (rol bu eylemi kapsıyor)',
          en: 'Decision: ALLOW (role grants the action)',
        }
      : { tr: 'Karar: RET (rolde bu izin yok)', en: 'Decision: DENY (role lacks the permission)' },
  });
  return { allowed, reason: allowed ? 'rbac-allow' : 'rbac-deny', steps };
}

export function evaluateAbac(
  user: User,
  action: Action,
  resource: Resource,
  rules: Rule[],
  combining: Combining = 'deny-overrides',
): Decision {
  const ctx: EvalContext = { user, action, resource };
  const steps: Step[] = [
    {
      kind: 'info',
      text: {
        tr: `İstek: ${user.name} → ${action} → ${resource.name.tr}. Birleştirme: ${combining === 'deny-overrides' ? 'ret önceliklidir (deny-overrides)' : 'ilk eşleşen kazanır (first-applicable)'}`,
        en: `Request: ${user.name} → ${action} → ${resource.name.en}. Combining: ${combining}`,
      },
    },
  ];
  let firstAllow: string | undefined;
  let firstDeny: string | undefined;
  let decided: Decision | undefined;

  rules.forEach((rule, i) => {
    if (decided) {
      steps.push({
        kind: 'skip',
        ruleId: rule.id,
        text: {
          tr: `#${i + 1} değerlendirilmedi (karar verildi)`,
          en: `#${i + 1} not evaluated (already decided)`,
        },
      });
      return;
    }
    let expr: Expr;
    try {
      expr = parseCondition(rule.condition);
    } catch (e) {
      steps.push({
        kind: 'error',
        ruleId: rule.id,
        text: {
          tr: `#${i + 1} sözdizimi hatası, atlandı: ${(e as Error).message}`,
          en: `#${i + 1} syntax error, skipped: ${(e as Error).message}`,
        },
      });
      return;
    }
    const comparisons: Comparison[] = [];
    const ok = evalExpr(expr, ctx, comparisons);
    const eff = rule.effect === 'allow' ? { tr: 'İZİN', en: 'ALLOW' } : { tr: 'RET', en: 'DENY' };
    steps.push({
      kind: ok ? 'match' : 'skip',
      ruleId: rule.id,
      comparisons,
      text: ok
        ? { tr: `#${i + 1} eşleşti → ${eff.tr}`, en: `#${i + 1} matched → ${eff.en}` }
        : { tr: `#${i + 1} eşleşmedi`, en: `#${i + 1} did not match` },
    });
    if (!ok) return;
    if (rule.effect === 'deny') firstDeny ??= rule.id;
    else firstAllow ??= rule.id;
    if (combining === 'first-applicable') {
      decided = {
        allowed: rule.effect === 'allow',
        reason: rule.effect === 'allow' ? 'allow-rule' : 'explicit-deny',
        ruleId: rule.id,
        steps,
      };
    }
  });

  let d: Decision;
  if (decided) d = decided;
  else if (firstDeny) d = { allowed: false, reason: 'explicit-deny', ruleId: firstDeny, steps };
  else if (firstAllow) d = { allowed: true, reason: 'allow-rule', ruleId: firstAllow, steps };
  else d = { allowed: false, reason: 'default-deny', steps };

  const idx = (id?: string) => rules.findIndex((r) => r.id === id) + 1;
  steps.push({
    kind: 'decision',
    text:
      d.reason === 'explicit-deny'
        ? {
            tr: `Karar: RET (#${idx(d.ruleId)} açık ret${combining === 'deny-overrides' ? '; açık ret her izni ezer' : ''})`,
            en: `Decision: DENY (#${idx(d.ruleId)} explicit deny${combining === 'deny-overrides' ? '; an explicit deny overrides every allow' : ''})`,
          }
        : d.reason === 'allow-rule'
          ? { tr: `Karar: İZİN (#${idx(d.ruleId)})`, en: `Decision: ALLOW (#${idx(d.ruleId)})` }
          : {
              tr: 'Karar: RET (hiçbir kural izin vermedi: varsayılan ret)',
              en: 'Decision: DENY (no rule allowed it: default deny)',
            },
  });
  return d;
}

/* ------------------------------------------------------------------ denetim */

export type Evaluator = (u: User, a: Action, r: Resource) => boolean;

/** Tüm (kullanıcı, eylem, kaynak) üçlülerinden izinli olanların anahtarları */
export function allowedSet(evaluate: Evaluator): Set<string> {
  const out = new Set<string>();
  for (const u of USERS)
    for (const r of RESOURCES)
      for (const a of ACTIONS) if (evaluate(u, a, r)) out.add(`${u.id}:${a}:${r.id}`);
  return out;
}

/** Temel yapılandırmaya göre fazladan verilmiş izinler (ayrıcalık yükseltme denetimi) */
export function extraGrants(base: Set<string>, current: Set<string>): string[] {
  return [...current].filter((k) => !base.has(k)).sort();
}

export const rbacEvaluator =
  (m: RbacMatrix): Evaluator =>
  (u, a, r) =>
    evaluateRbac(u, a, r, m).allowed;

export const abacEvaluator =
  (rules: Rule[], combining: Combining): Evaluator =>
  (u, a, r) =>
    evaluateAbac(u, a, r, rules, combining).allowed;
