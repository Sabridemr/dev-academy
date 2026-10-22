'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Code2, Play, TerminalSquare, X } from 'lucide-react';
import { traceHue } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { PlayerControls } from '../ui/PlayerControls';
import { LogList, Select, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  PY_MEMORY_SCENARIOS,
  SCENARIO_CODE,
  runPython,
  type PyEvent,
  type PyObjectView,
  type PyStep,
  type PyMemoryScenario,
} from './pythonMemory.logic';

const L = {
  tr: {
    title: 'Python bellek modeli: isim → nesne',
    scenario: 'Senaryo',
    scenarios: {
      aliasing: 'Takma ad (aliasing)',
      'shallow-vs-deep': 'Sığ ve derin kopya',
      'immutable-rebind': 'Değiştirilemez nesne ve yeniden bağlama',
      'function-args': 'Fonksiyon argümanları',
      'refcount-gc': 'Referans sayımı ve gc',
    } satisfies Record<PyMemoryScenario, string>,
    custom: 'Düzenlenmiş kod çalışıyor',
    edit: 'Kodu düzenle',
    run: 'Çalıştır',
    cancel: 'Vazgeç',
    editorLabel: 'Python kodu',
    supported:
      'Desteklenen: atama (=, +=), int/float/str/bool/None, list/tuple/dict, + - * // %, is/==, a[i], a[:], del, def/return, print, len, id, list(), append/extend/insert/pop/remove/clear/copy, import copy (copy.copy, copy.deepcopy), import gc (gc.collect). if/for/while/class yoktur.',
    code: 'Kod',
    names: 'İsimler (çerçeveler)',
    heap: 'Nesneler (heap)',
    global: 'global',
    noVars: 'Henüz isim yok',
    noObjects: 'Henüz nesne yok',
    output: 'Çıktı',
    events: 'Bu adımda olanlar',
    noEvents: 'Program başlamadı: "Adım ileri" ile ilk satırı çalıştır.',
    step: 'Adım',
    live: 'Canlı nesne',
    freedTotal: 'Silinen nesne',
    refcount: 'ref',
    mutable: 'değiştirilebilir',
    immutable: 'değiştirilemez',
    cached: 'önbellek',
    unreachable: 'erişilemez (döngü): gc.collect() bekliyor',
    freed: 'silindi',
    traceback: (line: number) => `Traceback (${line}. satır)`,
    parseError: (line: number) => `${line}. satır`,
    start: 'Program başlamadı',
    ran: (line: number) => `${line}. satır çalıştı`,
    legend:
      'Renkli #id rozetleri aynı nesneyi gösterir. Referans sayısı 0 olan nesne hemen silinir; önbellekteki küçük int ve True/False/None hiç silinmez.',
    ev: (e: PyEvent, repr: (id: number) => string) => {
      switch (e.kind) {
        case 'create':
          return `#${e.id}: yeni ${e.type} nesnesi oluşturuldu`;
        case 'reuse':
          return e.reason === 'small-int'
            ? `#${e.id}: küçük int önbelleğindeki nesne yeniden kullanıldı`
            : e.reason === 'interned'
              ? `#${e.id}: interned str yeniden kullanıldı`
              : `#${e.id}: tekil ${repr(e.id)} nesnesi kullanıldı`;
        case 'bind':
          return `${e.frame === 'global' ? '' : `${e.frame}.`}${e.name} → #${e.id} (isim bağlandı)`;
        case 'unbind':
          return `del ${e.name}: isim silindi (nesne değil)`;
        case 'mutate':
          return `#${e.id} yerinde değişti (kimlik aynı)`;
        case 'free':
          return e.cycle
            ? `#${e.id} ${e.type} ${e.repr}: gc döngüyü topladı`
            : `#${e.id} ${e.type} ${e.repr}: referans sayısı 0, silindi`;
        case 'call':
          return `${e.fn}() çağrıldı: yeni çerçeve açıldı`;
        case 'return':
          return `${e.fn}() #${e.id} döndürüyor: çerçeve kapanacak`;
        case 'gc':
          return `gc.collect(): ${e.freed} nesne toplandı`;
        case 'print':
          return `çıktı: ${e.text}`;
      }
    },
  },
  en: {
    title: 'Python memory model: name → object',
    scenario: 'Scenario',
    scenarios: {
      aliasing: 'Aliasing',
      'shallow-vs-deep': 'Shallow vs deep copy',
      'immutable-rebind': 'Immutable objects and rebinding',
      'function-args': 'Function arguments',
      'refcount-gc': 'Reference counting and gc',
    } satisfies Record<PyMemoryScenario, string>,
    custom: 'Running edited code',
    edit: 'Edit code',
    run: 'Run',
    cancel: 'Cancel',
    editorLabel: 'Python code',
    supported:
      'Supported: assignment (=, +=), int/float/str/bool/None, list/tuple/dict, + - * // %, is/==, a[i], a[:], del, def/return, print, len, id, list(), append/extend/insert/pop/remove/clear/copy, import copy (copy.copy, copy.deepcopy), import gc (gc.collect). No if/for/while/class.',
    code: 'Code',
    names: 'Names (frames)',
    heap: 'Objects (heap)',
    global: 'global',
    noVars: 'No names yet',
    noObjects: 'No objects yet',
    output: 'Output',
    events: 'What happened in this step',
    noEvents: 'The program has not started: run the first line with "Step forward".',
    step: 'Step',
    live: 'Live objects',
    freedTotal: 'Freed objects',
    refcount: 'ref',
    mutable: 'mutable',
    immutable: 'immutable',
    cached: 'cached',
    unreachable: 'unreachable (cycle): waiting for gc.collect()',
    freed: 'freed',
    traceback: (line: number) => `Traceback (line ${line})`,
    parseError: (line: number) => `Line ${line}`,
    start: 'Program not started',
    ran: (line: number) => `Line ${line} ran`,
    legend:
      'Coloured #id badges point to the same object. An object whose reference count drops to 0 is freed at once; cached small ints and True/False/None are never freed.',
    ev: (e: PyEvent, repr: (id: number) => string) => {
      switch (e.kind) {
        case 'create':
          return `#${e.id}: new ${e.type} object created`;
        case 'reuse':
          return e.reason === 'small-int'
            ? `#${e.id}: cached small int reused`
            : e.reason === 'interned'
              ? `#${e.id}: interned str reused`
              : `#${e.id}: singleton ${repr(e.id)} used`;
        case 'bind':
          return `${e.frame === 'global' ? '' : `${e.frame}.`}${e.name} → #${e.id} (name bound)`;
        case 'unbind':
          return `del ${e.name}: the name was removed (not the object)`;
        case 'mutate':
          return `#${e.id} changed in place (same identity)`;
        case 'free':
          return e.cycle
            ? `#${e.id} ${e.type} ${e.repr}: collected by gc (cycle)`
            : `#${e.id} ${e.type} ${e.repr}: refcount 0, freed`;
        case 'call':
          return `${e.fn}() called: new frame pushed`;
        case 'return':
          return `${e.fn}() returns #${e.id}: frame will be popped`;
        case 'gc':
          return `gc.collect(): ${e.freed} objects collected`;
        case 'print':
          return `output: ${e.text}`;
      }
    },
  },
};

const hueColor = (id: number, l = 45) => `hsl(${traceHue(id)} 70% ${l}%)`;
const isContainer = (o: PyObjectView | undefined) =>
  o !== undefined && (o.type === 'list' || o.type === 'tuple' || o.type === 'dict');

/** Kimlik rozeti: renk nesneye sabit, ok buradan çıkar (`arrow` = kap nesnesine ok çiz) */
function RefChip({ id, obj, arrow }: { id: number; obj?: PyObjectView; arrow: boolean }) {
  const scalar = obj && !isContainer(obj) && obj.type !== 'function' && obj.type !== 'module';
  return (
    <span
      data-pm-ref={arrow ? id : undefined}
      className="inline-flex items-center gap-1 rounded-md border px-1.5 font-mono text-xs"
      style={{ borderColor: hueColor(id, 50), color: hueColor(id, 40) }}
      title={`→ #${id}`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: hueColor(id, 50) }}
      />
      #{id}
      {scalar && <span className="text-fg">{obj.repr}</span>}
    </span>
  );
}

function HeapCard({
  obj,
  byId,
  changed,
  unreachable,
  l,
}: {
  obj: PyObjectView;
  byId: Map<number, PyObjectView>;
  changed: boolean;
  unreachable: boolean;
  l: (typeof L)['tr'] | (typeof L)['en'];
}) {
  const container = isContainer(obj);
  const slot = (id: number) => (
    <RefChip id={id} obj={byId.get(id)} arrow={isContainer(byId.get(id))} />
  );
  return (
    <div
      data-pm-obj={obj.id}
      className={cn(
        'w-fit max-w-full rounded-xl border bg-surface p-2 shadow-sm',
        changed && 'ring-2 ring-warning/70',
        unreachable && 'border-dashed bg-danger/5',
      )}
      style={{ borderColor: hueColor(obj.id, 65) }}
    >
      <p className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-mono font-semibold" style={{ color: hueColor(obj.id, 40) }}>
          #{obj.id}
        </span>
        <span className="font-mono text-muted">{obj.type}</span>
        {obj.type !== 'function' && obj.type !== 'module' && (
          <span className={cn('chip text-[10px]', obj.mutable ? 'chip-accent' : '')}>
            {obj.mutable ? l.mutable : l.immutable}
          </span>
        )}
        {obj.cached && <span className="chip text-[10px]">{l.cached}</span>}
        <span className="ml-auto font-mono text-muted" title="refcount">
          {l.refcount}={obj.refcount}
        </span>
      </p>
      {container ? (
        obj.type === 'dict' ? (
          obj.entries && obj.entries.length > 0 ? (
            <table className="text-xs">
              <tbody>
                {obj.entries.map(([k, v], i) => (
                  <tr key={i}>
                    <td className="pr-1 text-right">{slot(k)}</td>
                    <td className="px-1 text-muted">:</td>
                    <td>{slot(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="font-mono text-xs text-muted">{'{}'}</span>
          )
        ) : obj.items && obj.items.length > 0 ? (
          <div className="flex flex-wrap">
            {obj.items.map((id, i) => (
              <div key={i} className="min-w-8 border border-border px-1 py-0.5 text-center">
                <p className="text-[9px] leading-3 text-muted">{i}</p>
                {slot(id)}
              </div>
            ))}
          </div>
        ) : (
          <span className="font-mono text-xs text-muted">{obj.type === 'list' ? '[]' : '()'}</span>
        )
      ) : (
        <span className={cn('font-mono text-sm', obj.type === 'str' && 'text-success')}>
          {obj.repr}
        </span>
      )}
      {unreachable && <p className="mt-1 text-[11px] text-danger">{l.unreachable}</p>}
    </div>
  );
}

/** İsim/yuva rozetlerinden kap nesnelerine eğri oklar (sütunlar yan yanayken) */
function useArrows(container: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [arrows, setArrows] = useState<{ d: string; id: number }[]>([]);
  const compute = useCallback(() => {
    const root = container.current;
    const names = root?.querySelector<HTMLElement>('[data-col="names"]');
    const heap = root?.querySelector<HTMLElement>('[data-col="heap"]');
    if (
      !root ||
      !names ||
      !heap ||
      heap.getBoundingClientRect().left < names.getBoundingClientRect().right
    ) {
      setArrows([]);
      return;
    }
    const box = root.getBoundingClientRect();
    const out: { d: string; id: number }[] = [];
    root.querySelectorAll<HTMLElement>('[data-pm-ref]').forEach((src) => {
      const id = Number(src.dataset.pmRef);
      const target = root.querySelector<HTMLElement>(`[data-pm-obj="${id}"]`);
      if (!target || target.contains(src)) return;
      const a = src.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x1 = a.right - box.left;
      const y1 = a.top + a.height / 2 - box.top;
      const toLeft = b.left >= a.right - 4;
      const x2 = toLeft ? b.left - box.left - 2 : b.left + 14 - box.left;
      const y2 = toLeft ? b.top + 12 - box.top : b.top - box.top - 2;
      const dx = Math.max(30, Math.abs(x2 - x1) / 2);
      out.push({
        id,
        d: toLeft
          ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
          : `M${x1},${y1} C${x1 + 40},${y1} ${x2},${y2 - 40} ${x2},${y2}`,
      });
    });
    setArrows(out);
  }, [container]);

  useLayoutEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compute, ...deps]);

  useEffect(() => {
    const root = container.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(root);
    return () => ro.disconnect();
  }, [compute, container]);

  return arrows;
}

/** İsimlerden erişilemeyen (yalnızca döngüyle ayakta kalan) nesneler */
function unreachableIds(step: PyStep): Set<number> {
  const byId = new Map(step.heap.map((o) => [o.id, o]));
  const seen = new Set<number>();
  const stack = step.frames.flatMap((f) => f.vars.map(([, id]) => id));
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const o = byId.get(id);
    o?.items?.forEach((x) => stack.push(x));
    o?.entries?.forEach(([k, v]) => stack.push(k, v));
  }
  return new Set(
    step.heap.filter((o) => !seen.has(o.id) && !o.cached && o.refcount > 0).map((o) => o.id),
  );
}

export default function PythonMemorySim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initial = strParam(params, 'scenario', 'aliasing', PY_MEMORY_SCENARIOS);
  const [scenario, setScenario] = useState<PyMemoryScenario>(initial);
  const [code, setCode] = useState(SCENARIO_CODE[initial]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);
  const [draftError, setDraftError] = useState<ReturnType<typeof runPython>['error']>();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const memRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => runPython(code), [code]);
  const steps = result.steps;
  const total = steps.length;
  const step = steps[Math.min(index, total - 1)];
  const prev = index > 0 ? steps[index - 1] : undefined;
  const byId = useMemo(() => new Map(step.heap.map((o) => [o.id, o])), [step]);
  const unreachable = useMemo(() => unreachableIds(step), [step]);
  const changed = useMemo(() => {
    const before = new Map((prev?.heap ?? []).map((o) => [o.id, o.repr]));
    return new Set(step.heap.filter((o) => prev && before.get(o.id) !== o.repr).map((o) => o.id));
  }, [prev, step]);
  const boundNow = useMemo(
    () => new Set(step.events.flatMap((e) => (e.kind === 'bind' ? [`${e.frame}:${e.name}`] : []))),
    [step],
  );
  const freedTotal = useMemo(
    () => steps.slice(0, index + 1).reduce((n, s) => n + s.freed.length, 0),
    [steps, index],
  );
  const arrows = useArrows(memRef, [index, code, locale]);
  const lines = code.split('\n');
  const custom = code !== SCENARIO_CODE[scenario];

  const go = useCallback(
    (i: number) => {
      onInteract();
      setIndex(Math.max(0, Math.min(total - 1, i)));
    },
    [onInteract, total],
  );

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), reduced ? 1600 : 1000);
    return () => clearTimeout(timer);
  }, [playing, index, total, reduced]);

  const chooseScenario = (s: PyMemoryScenario) => {
    onInteract();
    setScenario(s);
    setCode(SCENARIO_CODE[s]);
    setDraft(SCENARIO_CODE[s]);
    setEditing(false);
    setDraftError(undefined);
    setPlaying(false);
    setIndex(0);
  };

  const applyDraft = () => {
    onInteract();
    const r = runPython(draft);
    // Sözdizimi ya da desteklenmeyen yapı: düzenleyicide kal, hatayı göster
    if (r.steps.length === 0) {
      setDraftError(r.error);
      return;
    }
    setDraftError(undefined);
    setCode(draft);
    setEditing(false);
    setPlaying(false);
    setIndex(0);
  };

  const reprOf = (id: number) => byId.get(id)?.repr ?? '';

  return (
    <SimShell
      title={l.title}
      toolbar={
        !editing && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              onInteract();
              setDraft(code);
              setPlaying(false);
              setEditing(true);
            }}
          >
            <Code2 size={14} /> {l.edit}
          </button>
        )
      }
      aside={
        <>
          <Select
            label={l.scenario}
            value={scenario}
            options={PY_MEMORY_SCENARIOS.map((s) => ({ id: s, label: l.scenarios[s] }))}
            onChange={chooseScenario}
          />
          {custom && <p className="text-xs text-muted">{l.custom}</p>}
          <div className="grid grid-cols-3 gap-2">
            <Stat label={l.step} value={`${index}/${total - 1}`} />
            <Stat label={l.live} value={step.heap.length} tone="primary" />
            <Stat
              label={l.freedTotal}
              value={freedTotal}
              tone={freedTotal ? 'danger' : undefined}
            />
          </div>
          <div>
            <p className="label">{l.events}</p>
            <LogList
              empty={l.noEvents}
              items={step.events.map((e, i) => ({
                key: i,
                text: l.ev(e, reprOf),
                tone: e.kind === 'free' ? 'danger' : e.kind === 'reuse' ? 'muted' : undefined,
              }))}
            />
          </div>
          <p className="text-xs leading-5 text-muted">{l.legend}</p>
        </>
      }
    >
      <div className="space-y-3">
        {editing ? (
          <div className="space-y-2">
            <label className="block">
              <span className="label">{l.editorLabel}</span>
              <textarea
                className="input min-h-56 font-mono text-[13px] leading-6"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            {draftError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-2 text-sm text-danger"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong>{l.parseError(draftError.line)}:</strong> {draftError.message[locale]}
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary btn-sm" onClick={applyDraft}>
                <Play size={14} /> {l.run}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setEditing(false);
                  setDraftError(undefined);
                }}
              >
                <X size={14} /> {l.cancel}
              </button>
            </div>
            <p className="text-xs leading-5 text-muted">{l.supported}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-bg/60">
            <div
              className="overflow-x-auto py-2 font-mono text-[13px] leading-6"
              aria-label={l.code}
            >
              {lines.map((text, i) => {
                const n = i + 1;
                const current = n === step.line;
                return (
                  <div
                    key={n}
                    className={cn(
                      'flex min-w-fit pr-4',
                      current && (step.error ? 'bg-danger/10' : 'bg-success/10'),
                    )}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className="w-6 shrink-0 text-center text-xs">
                      {current && (
                        <span className={step.error ? 'text-danger' : 'text-success'}>➜</span>
                      )}
                    </span>
                    <span className="w-7 shrink-0 select-none pr-3 text-right text-xs text-muted/70">
                      {n}
                    </span>
                    <span className="whitespace-pre">{text || ' '}</span>
                  </div>
                );
              })}
            </div>
            <PlayerControls
              playing={playing}
              onTogglePlay={() => {
                onInteract();
                if (index >= total - 1) setIndex(0);
                setPlaying((p) => !p);
              }}
              onPrev={() => {
                setPlaying(false);
                go(index - 1);
              }}
              onNext={() => {
                setPlaying(false);
                go(index + 1);
              }}
              onFirst={() => {
                setPlaying(false);
                go(0);
              }}
              onLast={() => {
                setPlaying(false);
                go(total - 1);
              }}
              canPrev={index > 0}
              canNext={index < total - 1}
              timeline={
                <p className="text-xs font-medium text-primary" aria-live="polite">
                  {step.line === 0 ? l.start : l.ran(step.line)}
                </p>
              }
            />
          </div>
        )}

        {step.error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 p-2 font-mono text-xs text-danger"
          >
            <p className="font-semibold">{l.traceback(step.error.line)}</p>
            <p>{step.error.message[locale]}</p>
          </div>
        )}

        <div
          ref={memRef}
          className="relative grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <div data-col="names">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{l.names}</p>
            <div className="space-y-2">
              {step.frames.map((f, fi) => {
                const active = fi === step.frames.length - 1;
                return (
                  <div
                    key={f.id}
                    className={cn(
                      'rounded-xl border p-2',
                      active
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border bg-surface opacity-80',
                    )}
                  >
                    <p className="mb-1 font-mono text-xs font-semibold">
                      {f.name === 'global' ? l.global : `${f.name}()`}
                    </p>
                    {f.vars.length === 0 ? (
                      <p className="text-xs text-muted">{l.noVars}</p>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {f.vars.map(([name, id]) => (
                            <tr
                              key={name}
                              className={cn(boundNow.has(`${f.name}:${name}`) && 'bg-warning/15')}
                            >
                              <td className="py-0.5 pr-2 text-right font-mono">{name}</td>
                              <td className="py-0.5">
                                <RefChip id={id} obj={byId.get(id)} arrow />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div data-col="heap">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{l.heap}</p>
            {step.heap.length === 0 && step.freed.length === 0 ? (
              <p className="text-xs text-muted">{l.noObjects}</p>
            ) : (
              <div className="flex flex-col items-start gap-3">
                {step.heap.map((o) => (
                  <HeapCard
                    key={o.id}
                    obj={o}
                    byId={byId}
                    changed={changed.has(o.id)}
                    unreachable={unreachable.has(o.id)}
                    l={l}
                  />
                ))}
                {step.freed.map((o) => (
                  <div
                    key={`freed-${o.id}`}
                    className="w-fit rounded-xl border border-dashed border-danger/50 p-2 text-xs text-muted opacity-70"
                  >
                    <span className="font-mono line-through">
                      #{o.id} {o.type} {o.repr}
                    </span>{' '}
                    <span className="text-danger">— {l.freed}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            {arrows.map((a, i) => (
              <path
                key={i}
                d={a.d}
                stroke={hueColor(a.id, 50)}
                fill="none"
                strokeWidth={1.5}
                opacity={0.8}
              />
            ))}
          </svg>
        </div>

        <div className="rounded-xl border border-border bg-elevated/40 px-3 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <TerminalSquare size={12} /> {l.output}
          </p>
          <pre
            className="max-h-32 min-h-6 overflow-auto whitespace-pre-wrap font-mono text-xs"
            aria-live="polite"
          >
            {step.output.join('\n')}
          </pre>
        </div>
      </div>
    </SimShell>
  );
}
