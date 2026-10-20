'use client';

import { useReducer } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  GIT_SCENARIOS,
  gitReducer,
  initialGitState,
  reachable,
  type Branch,
  type Commit,
  type GitScenario,
} from './gitGraph.logic';

const COL_W = 64;
const X0 = 48;
const LANE_Y: Record<Branch, number> = { main: 70, feature: 150 };
const H = 210;
const LANE_COLOR: Record<Branch, string> = {
  main: 'var(--da-primary)',
  feature: 'var(--da-accent)',
};

const L = {
  tr: {
    title: 'Git commit grafiği',
    hint: {
      merge:
        'merge, iki dalın geçmişini birleştiren yeni bir “merge commit” oluşturur; dallar ayrışmamışsa yalnızca dal işaretçisi ileri kayar (fast-forward).',
      rebase:
        'rebase, feature commit’lerini main’in ucuna yeniden oynatır: yeni kimlikli kopyalar (C3′) oluşur, geçmiş doğrusal kalır, eskiler sahipsiz kalır.',
      conflict:
        'İki dal aynı dosyayı (app.js) değiştirdi. merge ya da rebase çakışmada durur; çakışmayı çözüp devam etmen gerekir.',
    } satisfies Record<GitScenario, string>,
    resolve: 'Çakışmayı çöz ve devam et',
    conflictTitle: (f: string) => `Çakışma: ${f}`,
    conflictHelp:
      'Git iki değişikliği otomatik birleştiremedi. İşaretleri temizleyip iki satırı da koruyarak çöz, sonra git add ile işaretle.',
    ours: 'main’deki değişiklik',
    theirs: 'feature’daki değişiklik',
    commands: 'Komut günlüğü',
    head: 'HEAD',
    commits: 'Commit',
    blocked: 'Önce çakışmayı çöz.',
    orphanNote: 'Soluk commit’ler rebase sonrası hiçbir daldan erişilemez (reflog’da durur).',
    graph: 'Commit grafiği',
  },
  en: {
    title: 'Git commit graph',
    hint: {
      merge:
        'merge creates a new “merge commit” joining both histories; if the branches have not diverged, the branch pointer just moves forward (fast-forward).',
      rebase:
        'rebase replays the feature commits on top of main: copies with new ids (C3′) are created, history stays linear and the old ones become unreachable.',
      conflict:
        'Both branches changed the same file (app.js). merge or rebase stops at the conflict; you must resolve it to continue.',
    } satisfies Record<GitScenario, string>,
    resolve: 'Resolve conflict and continue',
    conflictTitle: (f: string) => `Conflict: ${f}`,
    conflictHelp:
      'Git could not combine both changes automatically. Clean up the markers keeping both lines, then mark it with git add.',
    ours: 'change on main',
    theirs: 'change on feature',
    commands: 'Command log',
    head: 'HEAD',
    commits: 'Commits',
    blocked: 'Resolve the conflict first.',
    orphanNote:
      'Faded commits are unreachable from any branch after the rebase (still in the reflog).',
    graph: 'Commit graph',
  },
};

const pos = (c: Commit) => ({ x: X0 + c.col * COL_W, y: LANE_Y[c.branch] });

export default function GitGraphSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const scenario = strParam(params, 'scenario', 'merge', GIT_SCENARIOS);
  const [state, dispatch] = useReducer(gitReducer, scenario, initialGitState);
  const live = reachable(state);
  const map = new Map(state.commits.map((c) => [c.id, c]));
  const width = Math.max(600, X0 * 2 + state.nextCol * COL_W);
  const t = (d: number) => ({ duration: reduced ? 0 : d });

  const act = (a: Parameters<typeof dispatch>[0]) => {
    onInteract();
    dispatch(a);
  };
  const blocked = state.conflict !== null;

  const headCommit = map.get(state.heads[state.head])!;
  const branchLabels = (['main', 'feature'] as const).map((b, k) => {
    const c = map.get(state.heads[b])!;
    const p = pos(c);
    // Aynı commit'i gösteren iki dal etiketi üst üste binmesin
    const same = state.heads.main === state.heads.feature;
    const y =
      c.branch === 'main'
        ? p.y - 30 - (same && k === 1 ? 26 : 0)
        : p.y + 22 + (same && k === 1 ? 26 : 0);
    return { b, x: p.x, y, isHead: state.head === b };
  });

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={blocked}
            onClick={() => act({ type: 'commit', branch: 'main' })}
          >
            <GitCommitHorizontal size={14} /> commit (main)
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={blocked}
            onClick={() => act({ type: 'commit', branch: 'feature' })}
          >
            <GitCommitHorizontal size={14} /> commit (feature)
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={blocked}
            onClick={() => act({ type: 'merge' })}
          >
            <GitMerge size={14} /> merge
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={blocked}
            onClick={() => act({ type: 'rebase' })}
          >
            <GitBranch size={14} /> rebase
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => act({ type: 'reset' })}>
            <RotateCcw size={14} /> reset
          </button>
        </>
      }
      aside={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={l.head}
              value={<span className="font-mono text-base">{state.head}</span>}
              tone="primary"
            />
            <Stat label={l.commits} value={live.size} />
          </div>
          <p className="font-mono text-xs text-muted">
            HEAD → {state.head} → {headCommit.label}
          </p>
          <div>
            <p className="label">{l.commands}</p>
            <LogList
              items={state.log.map((line, i) => ({
                key: i,
                text: line.kind === 'cmd' ? `$ ${line.text}` : line.text,
                tone: line.kind === 'error' ? 'danger' : line.kind === 'out' ? 'muted' : undefined,
              }))}
            />
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint[state.scenario]}</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-bg/60">
        <svg
          viewBox={`0 0 ${width} ${H}`}
          width={width}
          height={H}
          className="max-w-none"
          role="img"
          aria-label={l.graph}
        >
          {(['main', 'feature'] as const).map((b) => (
            <text key={b} x={8} y={LANE_Y[b] + 4} fontSize={12} fill="var(--da-muted)">
              {b === 'main' ? 'main' : 'feat'}
            </text>
          ))}
          {/* Kenarlar: ebeveyn → çocuk */}
          {state.commits.flatMap((c) =>
            c.parents.map((pid) => {
              const p = map.get(pid)!;
              const a = pos(p);
              const b = pos(c);
              const mid = (a.x + b.x) / 2;
              const d =
                a.y === b.y
                  ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
                  : `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
              const faded = !live.has(c.id);
              return (
                <motion.path
                  key={`${pid}-${c.id}`}
                  d={d}
                  fill="none"
                  stroke={LANE_COLOR[c.branch]}
                  strokeWidth={2.5}
                  strokeDasharray={faded ? '4 4' : undefined}
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1, opacity: faded ? 0.3 : 1 }}
                  transition={t(0.4)}
                />
              );
            }),
          )}
          {/* Commit düğümleri */}
          <AnimatePresence initial={false}>
            {state.commits.map((c) => {
              const p = pos(c);
              const faded = !live.has(c.id);
              const conflicted =
                state.conflict &&
                c.files.some((f) => state.conflict!.files.includes(f)) &&
                live.has(c.id) &&
                c.col > 0;
              return (
                <motion.g
                  key={c.id}
                  initial={reduced ? false : { opacity: 0, scale: 0.3 }}
                  animate={{ opacity: faded ? 0.35 : 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={t(0.35)}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                >
                  <title>{`${c.label} · ${c.message}${c.files.length ? ` (${c.files.join(', ')})` : ''}`}</title>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={c.merge ? 15 : 13}
                    fill="var(--da-surface)"
                    stroke={conflicted ? 'var(--da-danger)' : LANE_COLOR[c.branch]}
                    strokeWidth={c.id === headCommit.id ? 4 : 2.5}
                  />
                  {c.merge && <circle cx={p.x} cy={p.y} r={6} fill={LANE_COLOR[c.branch]} />}
                  {!c.merge && (
                    <text
                      x={p.x}
                      y={p.y + 4}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--da-fg)"
                    >
                      {c.label}
                    </text>
                  )}
                </motion.g>
              );
            })}
          </AnimatePresence>
          {/* Dal etiketleri ve HEAD */}
          {branchLabels.map((bl) => (
            <motion.g key={bl.b} initial={false} animate={{ x: bl.x, y: bl.y }} transition={t(0.4)}>
              <rect
                x={-34}
                y={-11}
                width={bl.isHead ? 96 : 68}
                height={22}
                rx={11}
                fill={LANE_COLOR[bl.b]}
                opacity={0.18}
                stroke={LANE_COLOR[bl.b]}
              />
              <text
                x={bl.isHead ? -26 : 0}
                y={4}
                textAnchor={bl.isHead ? 'start' : 'middle'}
                fontSize={12}
                fontWeight={600}
                fill="var(--da-fg)"
              >
                {bl.isHead ? `HEAD → ${bl.b}` : bl.b}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>
      {state.commits.some((c) => c.orphan) && (
        <p className="mt-2 text-xs text-muted">{l.orphanNote}</p>
      )}

      <AnimatePresence>
        {state.conflict && (
          <motion.div
            role="alert"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={t(0.25)}
            className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-danger-fg">
              <AlertTriangle size={16} /> {l.conflictTitle(state.conflict.files.join(', '))} (
              {state.conflict.op})
            </p>
            <p className="mt-1 text-xs text-muted">{l.conflictHelp}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-bg/70 p-2 font-mono text-xs leading-5">
              <span className="text-muted">{'<<<<<<< HEAD'}</span>
              {'\n'}
              <span className="text-primary">{`greet("merhaba") // ${l.ours}`}</span>
              {'\n'}
              <span className="text-muted">{'======='}</span>
              {'\n'}
              <span className="text-accent-fg">{`greet("hello") // ${l.theirs}`}</span>
              {'\n'}
              <span className="text-muted">{'>>>>>>> feature'}</span>
            </pre>
            <button
              type="button"
              className="btn-primary btn-sm mt-3"
              onClick={() => act({ type: 'resolve' })}
            >
              <Check size={14} /> {l.resolve}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </SimShell>
  );
}
