/**
 * TAHMİN ET, SONRA ÇALIŞTIR — soru üretimi (saf mantık)
 * ----------------------------------------------------
 * Bir kod izinden (`*.trace.json`) otomatik çoktan seçmeli sorular üretir:
 *  - output: "Program bitince çıktı ne olur?" (çeldiriciler: satır sırası değişmiş, sayı kaydırılmış,
 *    son satırı eksik çıktı)
 *  - variable: "N. satır (k. kez) çalıştıktan sonra `x` değeri ne?" — yalnızca global çerçeve;
 *    çeldiriciler aynı değişkenin izdeki diğer değerleri ve sayısal kaydırmalardır.
 * Üretim deterministiktir (izin sourceHash'inden tohumlanır): aynı iz her zaman aynı soruları verir.
 */
import type { CodeTrace, TraceStep, TraceValue } from '@devacademy/shared';

export interface OutputQuestion {
  kind: 'output';
  choices: string[];
  answer: number;
  /** Cevabın görüldüğü iz adımı (0 tabanlı) */
  step: number;
}

export interface VariableQuestion {
  kind: 'variable';
  line: number;
  /** Satırın kaçıncı kez tamamlandığı (1 tabanlı) */
  occurrence: number;
  /** Satır toplam kaç kez çalışıyor (1 ise "k. kez" söylenmez) */
  totalRuns: number;
  name: string;
  choices: string[];
  answer: number;
  step: number;
}

export type PredictQuestion = OutputQuestion | VariableQuestion;

const MAX_VALUE_LEN = 48;
const CHOICES = 4;

/** İzdeki bir değeri Python gösterimine çevirir (heap nesneleri özyinelemeli, döngü korumalı) */
export function renderTraceValue(
  v: TraceValue,
  step: TraceStep,
  depth = 0,
  seen = new Set<number>(),
): string {
  if (v.t === 'prim') return v.repr;
  const o = step.heap.find((h) => h.id === v.id);
  if (!o) return '?';
  if (seen.has(o.id) || depth > 4) return '...';
  seen.add(o.id);
  const r = (x: TraceValue) => renderTraceValue(x, step, depth + 1, seen);
  let out: string;
  switch (o.kind) {
    case 'list':
      out = `[${(o.items ?? []).map(r).join(', ')}]`;
      break;
    case 'tuple': {
      const items = (o.items ?? []).map(r);
      out = items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;
      break;
    }
    case 'set':
      out = o.items?.length ? `{${o.items.map(r).join(', ')}}` : 'set()';
      break;
    case 'dict':
      out = `{${(o.entries ?? []).map(([k, val]) => `${r(k)}: ${r(val)}`).join(', ')}}`;
      break;
    default:
      out = o.repr ?? `<${o.type}>`;
  }
  seen.delete(o.id);
  return out;
}

/** Deterministik sözde rastgele (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Metindeki sayılardan birini kaydırır (from: sondan kaçıncı sayı) */
export function shiftNumber(text: string, delta: number, fromEnd = 0): string | null {
  const matches = [...text.matchAll(/-?\d+(?:\.\d+)?/g)];
  const m = matches[matches.length - 1 - fromEnd];
  if (!m || m.index === undefined) return null;
  const n = Number(m[0]);
  const shifted = m[0].includes('.')
    ? (n + delta).toFixed(m[0].split('.')[1].length)
    : String(n + delta);
  return text.slice(0, m.index) + shifted + text.slice(m.index + m[0].length);
}

/** Çıktı satırlarını ilk sözcüklerine göre (kararlı) gruplar: tembel/sıralı yürütmeyi karıştıranların cevabı */
function groupedByPrefix(lines: string[]): string[] {
  const key = (l: string) => l.trim().split(/[\s:]/)[0] ?? '';
  const order: string[] = [];
  for (const l of lines) if (!order.includes(key(l))) order.push(key(l));
  return [...lines].sort((a, b) => order.indexOf(key(a)) - order.indexOf(key(b)));
}

function finish<Q extends PredictQuestion>(
  q: Omit<Q, 'choices' | 'answer'>,
  correct: string,
  distractors: string[],
  rand: () => number,
): Q | null {
  const uniq: string[] = [];
  for (const d of distractors) if (d !== correct && !uniq.includes(d)) uniq.push(d);
  if (uniq.length < 2) return null;
  const choices = [correct, ...uniq.slice(0, CHOICES - 1)];
  // Fisher–Yates
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { ...q, choices, answer: choices.indexOf(correct) } as Q;
}

function outputQuestion(trace: CodeTrace, rand: () => number): OutputQuestion | null {
  const last = trace.steps.length - 1;
  const out = trace.steps[last].stdout.replace(/\n$/, '');
  if (!out.trim()) return null;
  const lines = out.split('\n');
  const join = (ls: string[]) => ls.join('\n');
  const candidates: (string | null)[] = [];
  if (lines.length > 1) candidates.push(join(groupedByPrefix(lines)));
  candidates.push(shiftNumber(out, 1));
  if (lines.length > 1) candidates.push(join(lines.slice(0, -1)));
  candidates.push(shiftNumber(out, -1));
  if (lines.length > 1) candidates.push(join([...lines].reverse()));
  candidates.push(shiftNumber(out, 1, 1), shiftNumber(out, 2));
  return finish<OutputQuestion>(
    { kind: 'output', step: last },
    out,
    candidates.filter((c): c is string => c !== null && c.trim() !== ''),
    rand,
  );
}

interface Completion {
  /** Satırın tamamlandığı (sonraki satıra geçildiği) adım */
  step: number;
  /** Aynı çerçevede satırın başladığı adım */
  from: number;
  line: number;
}

/**
 * Global çerçevede tamamlanan satırlar: global çerçevenin en üstte olduğu ardışık iki adım arasında
 * satır değiştiyse önceki satır çalışmış demektir (aradaki fonksiyon çağrıları atlanır).
 */
function globalCompletions(steps: TraceStep[]): Completion[] {
  const out: Completion[] = [];
  let prev = -1;
  steps.forEach((s, i) => {
    if (s.frames.length !== 1) return;
    if (prev >= 0 && steps[prev].line !== s.line && steps[prev].event !== 'end')
      out.push({ step: i, from: prev, line: steps[prev].line });
    prev = i;
  });
  return out;
}

function globals(step: TraceStep): Map<string, TraceValue> {
  return new Map(step.frames[0].locals);
}

function isCallable(v: TraceValue, step: TraceStep): boolean {
  if (v.t !== 'ref') return false;
  const o = step.heap.find((h) => h.id === v.id);
  return (
    o?.kind === 'function' || o?.kind === 'class' || o?.kind === 'instance' || o?.kind === 'other'
  );
}

function variableCandidates(trace: CodeTrace) {
  const steps = trace.steps;
  const comps = globalCompletions(steps);
  const runs = new Map<number, number>();
  const cands: (Omit<VariableQuestion, 'choices' | 'answer'> & { value: string })[] = [];
  for (const c of comps) {
    const occurrence = (runs.get(c.line) ?? 0) + 1;
    runs.set(c.line, occurrence);
    const before = globals(steps[c.from]);
    const after = steps[c.step];
    for (const [name, v] of after.frames[0].locals) {
      if (name.startsWith('__') || isCallable(v, after)) continue;
      const value = renderTraceValue(v, after);
      const old = before.get(name);
      if (old && renderTraceValue(old, steps[c.from]) === value) continue;
      if (value.length > MAX_VALUE_LEN || value.includes('...')) continue;
      cands.push({
        kind: 'variable',
        line: c.line,
        occurrence,
        totalRuns: 0,
        name,
        step: c.step,
        value,
      });
    }
  }
  for (const c of cands) c.totalRuns = runs.get(c.line) ?? 1;
  return cands;
}

/** Liste/tuple değerin sırası bozulmuş sürümleri (sıralama, kararlılık, ters çevirme soruları için) */
function permutations(step: TraceStep, name: string): string[] {
  const v = globals(step).get(name);
  if (!v || v.t !== 'ref') return [];
  const o = step.heap.find((h) => h.id === v.id);
  if (!o || (o.kind !== 'list' && o.kind !== 'tuple') || !o.items || o.items.length < 2) return [];
  const items = o.items.map((x) => renderTraceValue(x, step));
  const wrap = (xs: string[]) =>
    o.kind === 'list'
      ? `[${xs.join(', ')}]`
      : xs.length === 1
        ? `(${xs[0]},)`
        : `(${xs.join(', ')})`;
  const swapped = [items[1], items[0], ...items.slice(2)];
  const lastSwap = [...items.slice(0, -2), items[items.length - 1], items[items.length - 2]];
  return [wrap(swapped), wrap([...items].reverse()), wrap(lastSwap)];
}

/** Aynı değişkenin izdeki diğer değerleri, sıra bozulmuş sürümler ve sayısal kaydırmalar */
function variableDistractors(
  trace: CodeTrace,
  name: string,
  value: string,
  atStep: number,
): string[] {
  const seen: { value: string; dist: number }[] = [];
  trace.steps.forEach((s, i) => {
    const v = globals(s).get(name);
    if (!v) return;
    const r = renderTraceValue(v, s);
    if (r.length <= MAX_VALUE_LEN && !seen.some((x) => x.value === r))
      seen.push({ value: r, dist: Math.abs(i - atStep) });
  });
  // Cevaba zamanca en yakın değerler en inandırıcı çeldiricidir (bir eksik/fazla tur)
  const nearby = seen.sort((a, b) => a.dist - b.dist).map((x) => x.value);
  const shifted = [shiftNumber(value, 1), shiftNumber(value, -1), shiftNumber(value, 2)].filter(
    (x): x is string => x !== null,
  );
  const out = [
    ...nearby.filter((v) => v !== value).slice(0, 2),
    ...permutations(trace.steps[atStep], name),
    ...shifted,
    ...nearby,
  ];
  if (value.startsWith('[') && value !== '[]') out.push('[]');
  if (/^'.*'$/.test(value)) out.push(value.slice(1, -1));
  return out;
}

/** İzden 1–3 soru üretir: önce son çıktı, sonra global değişkenlerle ilgili en fazla iki soru */
export function buildQuestions(trace: CodeTrace): PredictQuestion[] {
  const rand = rng(seedOf(trace.sourceHash));
  const out: PredictQuestion[] = [];
  const oq = outputQuestion(trace, rand);
  if (oq) out.push(oq);

  const cands = variableCandidates(trace);
  // İlginç olanları öne al: birden çok kez çalışan satır ya da birden çok değer alan değişken
  const picked: typeof cands = [];
  const tryPick = (c: (typeof cands)[number] | undefined) => {
    if (!c || picked.some((p) => p.name === c.name || p.step === c.step)) return;
    picked.push(c);
  };
  if (cands.length) {
    tryPick(cands[Math.floor((cands.length - 1) * 0.6)]);
    for (let i = cands.length - 1; i >= 0 && picked.length < 2; i--) tryPick(cands[i]);
  }
  for (const c of picked.sort((a, b) => a.step - b.step)) {
    const { value, ...rest } = c;
    const q = finish<VariableQuestion>(
      rest,
      value,
      variableDistractors(trace, c.name, value, c.step),
      rand,
    );
    if (q) out.push(q);
  }
  return out;
}

export function score(questions: PredictQuestion[], answers: (number | null)[]) {
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  return { correct, wrong: questions.length - correct };
}
