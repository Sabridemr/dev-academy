'use client';

import { useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Eye, EyeOff, Minus, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Select, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  SCENARIOS,
  SCENARIO_IDS,
  STRIDE,
  STRIDE_INFO,
  expectedThreats,
  scoreModel,
  threatDetail,
  toggleMark,
  type Marks,
  type ScenarioId,
  type Stride,
  type ThreatElement,
} from './threatModel.logic';

const W = 640;
const H = 340;

const L = {
  tr: {
    title: 'STRIDE tehdit modeli tuvali',
    scenario: 'Senaryo',
    pick: 'Diyagramda bir bileşene ya da veri akışına tıkla; STRIDE kategorilerinden hangilerinin bu öğeye uygulandığını işaretle.',
    applies: 'Bu öğeye uygulanır mı?',
    note: 'Kısa gerekçen',
    reveal: 'Bitirdim, göster',
    hide: 'Cevapları gizle',
    clear: 'İşaretleri temizle',
    found: 'Bulunan',
    extra: 'Fazla işaret',
    marked: 'İşaretlenen öğe',
    kinds: { external: 'Dış varlık', process: 'Süreç', store: 'Veri deposu', flow: 'Veri akışı' },
    status: { found: 'buldun', missed: 'kaçırdın', extra: 'beklenmiyor' },
    why: 'Neden',
    fix: 'Önlem',
    boundary: 'Güven sınırı',
    expectedNote:
      'Beklenen küme STRIDE-per-element temeline ve öğeye özgü risklere dayanır; tartışmaya açıktır.',
    diagram: 'Mimari diyagram ve güven sınırları',
  },
  en: {
    title: 'STRIDE threat model canvas',
    scenario: 'Scenario',
    pick: 'Click a component or data flow in the diagram; mark which STRIDE categories apply to it.',
    applies: 'Does it apply to this element?',
    note: 'Your short rationale',
    reveal: 'I’m done, show me',
    hide: 'Hide answers',
    clear: 'Clear marks',
    found: 'Found',
    extra: 'Extra marks',
    marked: 'Elements marked',
    kinds: {
      external: 'External entity',
      process: 'Process',
      store: 'Data store',
      flow: 'Data flow',
    },
    status: { found: 'found', missed: 'missed', extra: 'not expected' },
    why: 'Why',
    fix: 'Mitigation',
    boundary: 'Trust boundary',
    expectedNote:
      'The expected set is based on STRIDE-per-element plus element-specific risks; it is open to debate.',
    diagram: 'Architecture diagram and trust boundaries',
  },
};

/** Akış çizgisi: iki yönlü akışlar çakışmasın diye dik yönde kaydırılır, uçlar düğüm kenarında durur */
function flowGeometry(el: ThreatElement, all: ThreatElement[]) {
  const a = all.find((e) => e.id === el.from)!;
  const b = all.find((e) => e.id === el.to)!;
  const reverse = all.some((e) => e.kind === 'flow' && e.from === el.to && e.to === el.from);
  const ax = a.x ?? 0;
  const ay = a.y ?? 0;
  const bx = b.x ?? 0;
  const by = b.y ?? 0;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const off = reverse ? 9 : 0;
  const nx = -uy * off;
  const ny = ux * off;
  const pad = 58;
  return {
    x1: ax + ux * pad + nx,
    y1: ay + uy * pad + ny,
    x2: bx - ux * pad + nx,
    y2: by - uy * pad + ny,
    lx: (ax + bx) / 2 + nx * 2.2,
    ly: (ay + by) / 2 + ny * 2.2 - (reverse ? 0 : 8),
  };
}

export default function ThreatModelSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [scenarioId, setScenarioId] = useState<ScenarioId>(() =>
    strParam<ScenarioId>(params, 'scenario', 'web-app', SCENARIO_IDS),
  );
  const scenario = SCENARIOS[scenarioId];
  const [selected, setSelected] = useState<string>(scenario.elements[0].id);
  const [marks, setMarks] = useState<Marks>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);

  const score = scoreModel(scenario, marks);
  const el = scenario.elements.find((e) => e.id === selected) ?? scenario.elements[0];
  const elScore = score.perElement[el.id];
  const expected = new Set(expectedThreats(el));

  const select = (id: string) => {
    onInteract();
    setSelected(id);
  };
  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(id);
    }
  };

  const elementTone = (id: string) => {
    if (!revealed) return Object.values(marks[id] ?? {}).some(Boolean) ? 'marked' : 'none';
    const s = score.perElement[id];
    return s.missed.length === 0 && s.extra.length === 0
      ? 'ok'
      : s.missed.length
        ? 'missed'
        : 'extra';
  };
  const stroke = (id: string) => {
    const t = elementTone(id);
    return t === 'ok'
      ? 'var(--da-success)'
      : t === 'missed'
        ? 'var(--da-danger)'
        : t === 'extra'
          ? 'var(--da-warning)'
          : t === 'marked'
            ? 'var(--da-primary)'
            : 'var(--da-border)';
  };

  const nodes = scenario.elements.filter((e) => e.kind !== 'flow');
  const flows = scenario.elements.filter((e) => e.kind === 'flow');
  const markedCount = scenario.elements.length - score.untouched;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className={revealed ? 'btn-ghost' : 'btn-primary'}
            onClick={() => {
              onInteract();
              setRevealed((r) => !r);
            }}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />} {revealed ? l.hide : l.reveal}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              setMarks({});
              setNotes({});
              setRevealed(false);
            }}
          >
            <RotateCcw size={14} /> {l.clear}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.scenario}
            value={scenarioId}
            options={SCENARIO_IDS.map((id) => ({ id, label: SCENARIOS[id].title[locale] }))}
            onChange={(v) => {
              onInteract();
              setScenarioId(v);
              setSelected(SCENARIOS[v].elements[0].id);
              setMarks({});
              setNotes({});
              setRevealed(false);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            {revealed ? (
              <>
                <Stat
                  label={l.found}
                  value={<span data-testid="threat-score">{`${score.found}/${score.total}`}</span>}
                  tone={score.found === score.total ? 'success' : 'primary'}
                />
                <Stat
                  label={l.extra}
                  value={score.extra}
                  tone={score.extra ? 'warning' : undefined}
                />
              </>
            ) : (
              <Stat label={l.marked} value={`${markedCount}/${scenario.elements.length}`} />
            )}
          </div>
          <p className="text-xs text-muted">{revealed ? l.expectedNote : l.pick}</p>
        </>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={l.diagram}>
        <defs>
          <marker
            id="tm-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--da-muted)" />
          </marker>
        </defs>
        {scenario.boundaries.map((b, i) => (
          <g key={i} aria-hidden>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={14}
              fill="none"
              stroke="var(--da-danger)"
              strokeOpacity={0.6}
              strokeDasharray="6 5"
            />
            <text
              x={b.x + 10}
              y={b.y + 16}
              fontSize={11}
              fill="var(--da-danger)"
              fontFamily="inherit"
            >
              {l.boundary}: {b.label[locale]}
            </text>
          </g>
        ))}
        {flows.map((f) => {
          const g = flowGeometry(f, scenario.elements);
          const active = f.id === el.id;
          return (
            <g
              key={f.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${l.kinds.flow}: ${f.label[locale]}`}
              data-testid={`tm-${f.id}`}
              onClick={() => select(f.id)}
              onKeyDown={onKey(f.id)}
              className="cursor-pointer outline-none focus-visible:[&>line]:stroke-[var(--da-primary)]"
            >
              <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="transparent" strokeWidth={16} />
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                stroke={active ? 'var(--da-primary)' : stroke(f.id)}
                strokeWidth={active ? 3 : 2}
                markerEnd="url(#tm-arrow)"
              />
              <text
                x={g.lx}
                y={g.ly}
                fontSize={10}
                textAnchor="middle"
                fill={active ? 'var(--da-primary)' : 'var(--da-muted)'}
                fontFamily="inherit"
              >
                {f.label[locale]}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const active = n.id === el.id;
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const s = active ? 'var(--da-primary)' : stroke(n.id);
          const sw = active ? 3 : 2;
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${l.kinds[n.kind]}: ${n.label[locale]}`}
              data-testid={`tm-${n.id}`}
              onClick={() => select(n.id)}
              onKeyDown={onKey(n.id)}
              className="cursor-pointer outline-none"
            >
              {n.kind === 'process' ? (
                <circle cx={x} cy={y} r={52} fill="var(--da-surface)" stroke={s} strokeWidth={sw} />
              ) : n.kind === 'store' ? (
                <>
                  <rect x={x - 60} y={y - 20} width={120} height={40} fill="var(--da-surface)" />
                  <line
                    x1={x - 60}
                    y1={y - 20}
                    x2={x + 60}
                    y2={y - 20}
                    stroke={s}
                    strokeWidth={sw}
                  />
                  <line
                    x1={x - 60}
                    y1={y + 20}
                    x2={x + 60}
                    y2={y + 20}
                    stroke={s}
                    strokeWidth={sw}
                  />
                </>
              ) : (
                <rect
                  x={x - 58}
                  y={y - 24}
                  width={116}
                  height={48}
                  rx={4}
                  fill="var(--da-surface)"
                  stroke={s}
                  strokeWidth={sw}
                />
              )}
              <text
                x={x}
                y={y + 4}
                fontSize={11}
                textAnchor="middle"
                fill="var(--da-fg)"
                fontFamily="inherit"
                fontWeight={600}
              >
                {n.label[locale]}
              </text>
            </g>
          );
        })}
      </svg>

      <motion.div
        key={`${scenarioId}-${el.id}`}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="mt-3 rounded-xl border border-border bg-surface p-3"
        data-testid="tm-panel"
      >
        <p className="text-sm font-semibold">
          <span className="chip mr-2">{l.kinds[el.kind]}</span>
          {el.label[locale]}
        </p>
        <p className="mt-1 text-xs text-muted">{l.applies}</p>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {STRIDE.map((s: Stride) => {
            const checked = !!marks[el.id]?.[s];
            const status = !revealed
              ? null
              : elScore.found.includes(s)
                ? 'found'
                : elScore.missed.includes(s)
                  ? 'missed'
                  : elScore.extra.includes(s)
                    ? 'extra'
                    : null;
            const detail = revealed && expected.has(s) ? threatDetail(el, s) : null;
            const noteKey = `${el.id}:${s}`;
            return (
              <li
                key={s}
                className={cn(
                  'rounded-xl border p-2 text-sm',
                  status === 'found' && 'border-success/50 bg-success/5',
                  status === 'missed' && 'border-danger/50 bg-danger/5',
                  status === 'extra' && 'border-warning/50 bg-warning/5',
                  !status && 'border-border',
                )}
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--da-primary)]"
                    checked={checked}
                    onChange={() => {
                      onInteract();
                      setMarks((m) => toggleMark(m, el.id, s));
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono font-bold text-primary">{s}</span>{' '}
                    {STRIDE_INFO[s].name[locale]}
                    <span className="block text-[11px] text-muted">
                      {STRIDE_INFO[s].property[locale]}
                    </span>
                  </span>
                  {status && (
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 text-[11px] font-medium',
                        status === 'found' && 'text-success',
                        status === 'missed' && 'text-danger',
                        status === 'extra' && 'text-warning',
                      )}
                    >
                      {status === 'found' ? (
                        <Check size={12} />
                      ) : status === 'missed' ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Minus size={12} />
                      )}
                      {l.status[status]}
                    </span>
                  )}
                </label>
                {checked && (
                  <input
                    className="input mt-1.5 h-8 text-xs"
                    placeholder={l.note}
                    aria-label={`${l.note} (${s})`}
                    value={notes[noteKey] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [noteKey]: e.target.value }))}
                  />
                )}
                {detail && (
                  <p className="mt-1.5 text-xs leading-5">
                    <span className="font-medium">{l.why}:</span> {detail.why[locale]}
                    <br />
                    <span className="font-medium text-success">{l.fix}:</span> {detail.fix[locale]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </SimShell>
  );
}
