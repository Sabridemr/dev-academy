'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  TerminalSquare,
} from 'lucide-react';
import {
  changedTraceObjects,
  changedTraceVars,
  previousTraceLine,
  traceHue,
  type CodeTrace,
  type LocalizedString,
  type TraceHeapObject,
  type TraceStep,
  type TraceValue,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { getHighlighter } from './CodeBlock';

type Token = { content: string; htmlStyle?: Record<string, string> };

/** Python kodunu satır satır Shiki belirteçlerine çevirir (yüklenene kadar düz metin) */
function useCodeTokens(code: string): Token[][] | null {
  const [tokens, setTokens] = useState<Token[][] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getHighlighter()
      .then((h) => {
        const out = h.codeToTokens(code, {
          lang: 'python',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        });
        if (!cancelled) setTokens(out.tokens as Token[][]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code]);
  return tokens;
}

/** Değişken/alan değeri: basit değer metin olarak, referans renkli bir uç (ok buradan çıkar) */
function Value({ value }: { value: TraceValue }) {
  if (value.t === 'prim') {
    return (
      <span className={cn('font-mono', value.type === 'str' ? 'text-success' : 'text-fg')}>
        {value.repr}
      </span>
    );
  }
  const hue = traceHue(value.id);
  return (
    <span
      data-ref={value.id}
      className="inline-flex items-center gap-1 rounded-md border px-1.5 font-mono text-xs"
      style={{ borderColor: `hsl(${hue} 70% 50%)`, color: `hsl(${hue} 70% 42%)` }}
      title={`→ #${value.id}`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: `hsl(${hue} 70% 50%)` }}
      />
      #{value.id}
    </span>
  );
}

function ObjectLabel({ obj }: { obj: TraceHeapObject }) {
  const { t } = useI18n();
  const hue = traceHue(obj.id);
  const label =
    obj.kind === 'instance'
      ? t('trace.instanceOf', { name: obj.type })
      : obj.kind === 'class'
        ? `class ${obj.repr ?? obj.type}`
        : obj.kind === 'function'
          ? 'function'
          : obj.type;
  return (
    <p className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
      <span className="font-medium">{label}</span>
      <span className="font-mono" style={{ color: `hsl(${hue} 70% 42%)` }}>
        #{obj.id}
      </span>
    </p>
  );
}

function FieldTable({ rows }: { rows: [React.ReactNode, TraceValue][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} className="border-t border-border first:border-t-0">
            <td className="py-0.5 pr-2 font-mono text-muted">{k}</td>
            <td className="py-0.5">
              <Value value={v} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HeapObject({ obj, changed }: { obj: TraceHeapObject; changed: boolean }) {
  const hue = traceHue(obj.id);
  return (
    <div
      data-obj={obj.id}
      className={cn(
        'w-fit max-w-full rounded-xl border bg-surface p-2 shadow-sm transition-shadow',
        changed && 'ring-2 ring-warning/70',
      )}
      style={{ borderColor: `hsl(${hue} 60% 70% / 0.8)` }}
    >
      <ObjectLabel obj={obj} />
      {obj.kind === 'prim' || obj.kind === 'other' ? (
        <span className={cn('font-mono text-sm', obj.type === 'str' && 'text-success')}>
          {obj.repr}
        </span>
      ) : obj.kind === 'function' ? (
        <>
          <span className="font-mono text-sm">{obj.repr}</span>
          {obj.attrs && obj.attrs.length > 0 && (
            <div className="mt-1 border-t border-border pt-1">
              <FieldTable rows={obj.attrs.map(([k, v]) => [k, v])} />
            </div>
          )}
        </>
      ) : obj.kind === 'list' || obj.kind === 'tuple' || obj.kind === 'set' ? (
        obj.items && obj.items.length > 0 ? (
          <div className="flex flex-wrap">
            {obj.items.map((v, i) => (
              <div
                key={i}
                className="min-w-8 border border-border px-1.5 py-0.5 text-center text-xs"
              >
                {obj.kind !== 'set' && <p className="text-[9px] leading-3 text-muted">{i}</p>}
                <Value value={v} />
              </div>
            ))}
          </div>
        ) : (
          <span className="font-mono text-xs text-muted">
            {obj.kind === 'list' ? '[]' : obj.kind === 'tuple' ? '()' : 'set()'}
          </span>
        )
      ) : obj.kind === 'dict' ? (
        obj.entries && obj.entries.length > 0 ? (
          <FieldTable rows={obj.entries.map(([k, v]) => [<Value key="k" value={k} />, v])} />
        ) : (
          <span className="font-mono text-xs text-muted">{'{}'}</span>
        )
      ) : obj.attrs && obj.attrs.length > 0 ? (
        <FieldTable rows={obj.attrs.map(([k, v]) => [k, v])} />
      ) : (
        <span className="text-xs text-muted">—</span>
      )}
    </div>
  );
}

/** Not ve alt yazılarda `kod` parçalarını kod olarak gösterir (tam Markdown gerekmez) */
function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
          <code key={i} className="rounded bg-elevated px-1 font-mono text-[0.9em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

interface Arrow {
  d: string;
  hue: number;
}

/** Referans uçlarından nesnelere eğri oklar (yalnızca çerçeveler ile heap yan yana sığdığında) */
function useArrows(container: React.RefObject<HTMLDivElement | null>, deps: unknown[]): Arrow[] {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const compute = useCallback(() => {
    const root = container.current;
    const framesCol = root?.querySelector<HTMLElement>('[data-col="frames"]');
    const heapCol = root?.querySelector<HTMLElement>('[data-col="heap"]');
    // Dar ekranda sütunlar alt alta: oklar karışır, renkli #id rozetleri eşleştirmeye yeter
    if (
      !root ||
      !framesCol ||
      !heapCol ||
      heapCol.getBoundingClientRect().left < framesCol.getBoundingClientRect().right
    ) {
      setArrows([]);
      return;
    }
    const box = root.getBoundingClientRect();
    const out: Arrow[] = [];
    root.querySelectorAll<HTMLElement>('[data-ref]').forEach((src) => {
      const id = src.dataset.ref;
      const target = root.querySelector<HTMLElement>(`[data-obj="${id}"]`);
      if (!target || target.contains(src)) return;
      const a = src.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x1 = a.right - box.left;
      const y1 = a.top + a.height / 2 - box.top;
      // Hedef kaynağın sağındaysa sol kenara, değilse (heap içi referans) üst kenara bağlan
      const toLeft = b.left >= a.right - 4;
      const x2 = toLeft ? b.left - box.left - 2 : b.left + 14 - box.left;
      const y2 = toLeft ? b.top + 12 - box.top : b.top - box.top - 2;
      const dx = Math.max(30, Math.abs(x2 - x1) / 2);
      const d = toLeft
        ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
        : `M${x1},${y1} C${x1 + 40},${y1} ${x2},${y2 - 40} ${x2},${y2}`;
      out.push({ d, hue: traceHue(Number(id)) });
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

/**
 * Kod izi oynatıcısı: soldaki kodda çalışacak satır (yeşil ok) ve az önce çalışan satır (soluk ok),
 * sağda çağrı yığını (çerçeveler + değişkenler) ile heap nesneleri ve aralarındaki referans okları,
 * altta program çıktısı. Klavye: ← → adım, Home/End baş/son.
 */
export function TraceViewer({
  trace,
  title,
  caption,
}: {
  trace: CodeTrace;
  title?: LocalizedString;
  caption?: LocalizedString;
}) {
  const { t, tl } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stateRef = useRef<HTMLDivElement>(null);
  const total = trace.steps.length;
  const step: TraceStep = trace.steps[index];
  const prev = index > 0 ? trace.steps[index - 1] : undefined;
  const tokens = useCodeTokens(trace.code);
  const lines = useMemo(() => trace.code.split('\n'), [trace.code]);
  const changedObjects = useMemo(() => changedTraceObjects(prev, step), [prev, step]);
  const changedVars = useMemo(() => changedTraceVars(prev, step), [prev, step]);
  const justRan = previousTraceLine(trace.steps, index);
  const arrows = useArrows(stateRef, [index]);
  const top = step.frames[step.frames.length - 1];

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), reduced ? 1600 : 900);
    return () => clearTimeout(timer);
  }, [playing, index, total, reduced]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => go(index + 1),
      ArrowLeft: () => go(index - 1),
      Home: () => go(0),
      End: () => go(total - 1),
    };
    if (keys[e.key]) {
      e.preventDefault();
      setPlaying(false);
      keys[e.key]();
    }
  };

  const status =
    step.event === 'call'
      ? t('trace.event.call', { name: top.name })
      : step.event === 'return'
        ? t('trace.event.return', { name: top.name })
        : step.event === 'exception'
          ? t('trace.event.exception')
          : step.event === 'end'
            ? step.exception
              ? t('trace.event.crashed')
              : t('trace.event.end')
            : t('trace.event.line', { line: step.line });

  return (
    <figure
      className="card overflow-hidden"
      aria-roledescription={t('trace.role')}
      aria-label={title ? tl(title) : t('trace.role')}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title ? tl(title) : t('trace.role')}</p>
          <p className="text-xs text-muted">{t('trace.hint')}</p>
        </div>
        <span className="chip shrink-0">Python {trace.pythonVersion}</span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Kod + çıktı */}
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div
            className="shiki overflow-x-auto py-2 font-mono text-[13px] leading-6"
            aria-label={t('trace.code')}
          >
            {lines.map((text, i) => {
              const n = i + 1;
              const current = n === step.line;
              const ran = n === justRan;
              return (
                <div
                  key={n}
                  className={cn(
                    'flex min-w-fit pr-4',
                    current &&
                      (step.event === 'exception' || (step.event === 'end' && step.exception)
                        ? 'bg-danger/10'
                        : 'bg-success/10'),
                  )}
                  aria-current={current ? 'step' : undefined}
                >
                  <span className="w-6 shrink-0 text-center text-xs leading-6">
                    {current ? (
                      <span className={step.event === 'exception' ? 'text-danger' : 'text-success'}>
                        ➜
                      </span>
                    ) : ran ? (
                      <span className="text-muted/60">➜</span>
                    ) : null}
                  </span>
                  <span className="w-7 shrink-0 select-none pr-3 text-right text-xs leading-6 text-muted/70">
                    {n}
                  </span>
                  <span className="whitespace-pre">
                    {tokens?.[i]
                      ? tokens[i].map((tok, j) => (
                          <span key={j} style={tok.htmlStyle as React.CSSProperties}>
                            {tok.content}
                          </span>
                        ))
                      : text || ' '}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border bg-elevated/40 px-4 py-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              <TerminalSquare size={12} /> {t('trace.output')}
            </p>
            <pre
              className="max-h-32 min-h-6 overflow-auto whitespace-pre-wrap font-mono text-xs"
              aria-live="polite"
            >
              {step.stdout}
              {step.event === 'end' && step.exception && (
                <span className="text-danger">
                  {'Traceback …\n'}
                  {step.exception}
                </span>
              )}
            </pre>
          </div>
        </div>

        {/* Çerçeveler ve heap */}
        <div
          ref={stateRef}
          className="relative grid gap-4 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <div data-col="frames">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              {t('trace.frames')}
            </p>
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
                      {f.name === 'Global' ? t('trace.global') : f.name}
                    </p>
                    {f.locals.length === 0 ? (
                      <p className="text-xs text-muted">{t('trace.noVars')}</p>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {f.locals.map(([name, v]) => (
                            <tr
                              key={name}
                              className={cn(changedVars.has(`${f.id}:${name}`) && 'bg-warning/15')}
                            >
                              <td className="py-0.5 pr-2 text-right font-mono">{name}</td>
                              <td className="py-0.5">
                                <Value value={v} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {active && step.event === 'return' && step.returnValue && (
                      <p className="mt-1 flex items-center gap-1.5 border-t border-border pt-1 text-xs">
                        <span className="text-muted">{t('trace.returns')}</span>
                        <Value value={step.returnValue} />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div data-col="heap">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              {t('trace.heap')}
            </p>
            {step.heap.length === 0 ? (
              <p className="text-xs text-muted">{t('trace.noObjects')}</p>
            ) : (
              <div className="flex flex-col items-start gap-3">
                {step.heap.map((o) => (
                  <HeapObject key={o.id} obj={o} changed={changedObjects.has(o.id)} />
                ))}
              </div>
            )}
          </div>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            {arrows.map((a, i) => (
              <g
                key={i}
                stroke={`hsl(${a.hue} 70% 50%)`}
                fill="none"
                strokeWidth={1.5}
                opacity={0.8}
              >
                <path d={a.d} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Açıklama + durum */}
      <div className="border-t border-border bg-elevated/50 px-4 py-2.5 text-sm" aria-live="polite">
        <p
          className={cn(
            'text-xs font-medium',
            step.event === 'exception' || step.exception ? 'text-danger' : 'text-primary',
          )}
        >
          {status}
          {step.exception ? ` — ${step.exception}` : ''}
        </p>
        {step.note && (
          <p className="mt-0.5 leading-6">
            <InlineCode text={tl(step.note)} />
          </p>
        )}
      </div>

      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
        <button
          type="button"
          className="btn-icon"
          onClick={() => go(0)}
          disabled={index === 0}
          aria-label={t('trace.first')}
          title={t('trace.first')}
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label={t('player.stepBack')}
          title={t('player.stepBack')}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn-primary h-9 px-3"
          onClick={() => {
            if (index >= total - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? t('player.pause') : t('player.play')}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span className="hidden sm:inline">{playing ? t('player.pause') : t('player.play')}</span>
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => go(index + 1)}
          disabled={index === total - 1}
          aria-label={t('player.stepForward')}
          title={t('player.stepForward')}
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => go(total - 1)}
          disabled={index === total - 1}
          aria-label={t('trace.last')}
          title={t('trace.last')}
        >
          <ChevronsRight size={18} />
        </button>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            go(Number(e.target.value));
          }}
          className="mx-1 min-w-[120px] flex-1 accent-[var(--da-primary)]"
          aria-label={t('player.step', { current: index + 1, total })}
        />
        <span className="w-16 text-right font-mono text-xs text-muted">
          {index + 1}/{total}
        </span>
      </div>

      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          <InlineCode text={tl(caption)} />
        </figcaption>
      )}
    </figure>
  );
}
