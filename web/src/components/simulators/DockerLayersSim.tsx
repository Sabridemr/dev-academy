'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  FileCode2,
  FolderGit2,
  Info,
  Package,
  RotateCcw,
  ShieldAlert,
  TerminalSquare,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  DOCKER_EXAMPLES,
  EXAMPLES,
  lintDockerfile,
  parseDockerfile,
  planBuild,
  type BuildPlan,
  type Change,
  type DockerExampleId,
  type DockerWarning,
  type LayerInfo,
  type ParseError,
  type WarningCode,
} from './dockerLayers.logic';

const L = {
  tr: {
    title: 'Dockerfile → imaj katmanları',
    example: 'Hazır örnek',
    editor: 'Dockerfile',
    context: 'Build context boyutu (COPY . .)',
    cacheSim: 'Build cache simülasyonu: ne değişti?',
    change: {
      none: 'Değişiklik yok',
      deps: 'package.json değişti',
      src: 'src/ değişti',
      run: 'RUN satırı değişti',
    },
    runLine: 'Değişen RUN satırı',
    noRun: 'Dockerfile’da RUN satırı yok.',
    stage: (i: number, name?: string) => `Aşama ${i}${name ? `: ${name}` : ''}`,
    finalBadge: 'final imaj',
    notFinal: 'final imaja girmez',
    skipped: 'atlanır (kullanılmıyor)',
    base: 'taban imaj',
    baseFromStage: (s: string) => `${s} aşamasından devam`,
    metadata: 'metadata (katman yok)',
    status: { cached: 'cache', rebuilt: 'yeniden', skipped: 'atlandı' },
    cause: 'cache burada bozuldu',
    finalSize: 'Final imaj (tahmini)',
    finalLayers: 'Katman (final)',
    rebuilt: 'Yeniden derlenen',
    rebuiltValue: (n: number, mb: number) => `${n} katman · ${fmtMb(mb)}`,
    allCached: 'Tüm adımlar cache’ten geldi.',
    missFrom: (line: number) =>
      `Cache ${line}. satırda bozuldu; o adım ve aynı aşamadaki sonraki adımlar yeniden derlenir.`,
    warnings: 'Uyarılar',
    noWarnings: 'Uyarı yok: sıra, etiket ve kullanıcı ayarları iyi görünüyor.',
    errors: 'Ayrıştırma hataları',
    error: (e: ParseError) =>
      e.code === 'unknown-instruction'
        ? `${e.line}. satır: bilinmeyen talimat “${e.text}”`
        : e.code === 'before-from'
          ? `${e.line}. satır: ${e.text} FROM’dan önce gelemez (yalnızca ARG gelebilir)`
          : e.code === 'missing-args'
            ? `${e.line}. satır: ${e.text} argüman bekliyor`
            : 'Dockerfile en az bir FROM içermeli',
    warning: {
      'copy-all-before-install':
        'COPY . . bağımlılık kurulumundan önce: her kod değişikliği kurulum katmanının cache’ini bozar. Önce yalnızca package.json / requirements.txt’yi kopyala, kurulumu çalıştır, sonra kodu kopyala.',
      'apt-no-cleanup':
        'apt-get install sonrası /var/lib/apt/lists temizlenmiyor: paket listeleri katmanda kalır (~40 MB). Aynı RUN içinde “&& rm -rf /var/lib/apt/lists/*” ekle.',
      'apt-update-alone':
        'apt-get update ayrı bir RUN’da: cache’te eski paket listesi kalır ve sonraki install eski sürümler kurabilir. update ve install’ı tek RUN’da birleştir.',
      'latest-tag':
        'Taban imaj etiketsiz ya da :latest — derlemeler tekrarlanabilir olmaz, imaj sessizce değişir. Sabit sürüm (ör. node:22-alpine) ya da digest kullan.',
      'root-user':
        'Final aşamada USER yok: konteyner root olarak çalışır. Bir açık, konteynerin içinde root yetkisi demektir; USER ile ayrıcalıksız kullanıcıya geç.',
      'merge-runs':
        'Ardışık RUN satırları birleştirilebilir: her RUN ayrı katmandır; ilişkili komutları && ile tek RUN’da toplamak katman sayısını ve boyutu azaltır.',
      'secret-in-env':
        'Gizli bilgi ENV/ARG ile imaja gömülüyor: imaj geçmişinde (docker history) herkes görebilir. Çalışma anında ortam değişkeni ya da BuildKit secret kullan.',
      'add-local':
        'Yerel dosya için ADD yerine COPY tercih edilir; ADD arşivleri açma ve URL indirme gibi örtük davranışlar içerir.',
      'pip-cache':
        'pip install --no-cache-dir olmadan çalışıyor: pip’in indirme önbelleği katmanda kalır.',
    } satisfies Record<WarningCode, string>,
    line: (n: number) => `${n}. satır`,
    compare: 'Önce / sonra',
    before: 'Önce (örnek)',
    after: 'Şimdi (editör)',
    rowSize: 'Final boyut',
    rowLayers: 'Katman',
    rowWarnings: 'Uyarı',
    rowSrc: 'src/ değişince yeniden',
    loadAlt: (label: string) => `Yükle: ${label}`,
    resetExample: 'Örneğe dön',
    sizesNote:
      'Boyutlar kaba kurallarla tahmin edilir (taban imaj tablosu, apt/npm/pip kuralları); gerçek derleme değildir.',
    layerList: 'Katman yığını',
  },
  en: {
    title: 'Dockerfile → image layers',
    example: 'Example',
    editor: 'Dockerfile',
    context: 'Build context size (COPY . .)',
    cacheSim: 'Build cache simulation: what changed?',
    change: {
      none: 'No change',
      deps: 'package.json changed',
      src: 'src/ changed',
      run: 'RUN line changed',
    },
    runLine: 'Changed RUN line',
    noRun: 'The Dockerfile has no RUN line.',
    stage: (i: number, name?: string) => `Stage ${i}${name ? `: ${name}` : ''}`,
    finalBadge: 'final image',
    notFinal: 'not in final image',
    skipped: 'skipped (unused)',
    base: 'base image',
    baseFromStage: (s: string) => `continues from stage ${s}`,
    metadata: 'metadata (no layer)',
    status: { cached: 'cached', rebuilt: 'rebuilt', skipped: 'skipped' },
    cause: 'cache broke here',
    finalSize: 'Final image (estimated)',
    finalLayers: 'Layers (final)',
    rebuilt: 'Rebuilt',
    rebuiltValue: (n: number, mb: number) => `${n} layers · ${fmtMb(mb)}`,
    allCached: 'Every step came from the cache.',
    missFrom: (line: number) =>
      `The cache broke at line ${line}; that step and every later step in the same stage are rebuilt.`,
    warnings: 'Warnings',
    noWarnings: 'No warnings: ordering, tags and user settings look good.',
    errors: 'Parse errors',
    error: (e: ParseError) =>
      e.code === 'unknown-instruction'
        ? `line ${e.line}: unknown instruction “${e.text}”`
        : e.code === 'before-from'
          ? `line ${e.line}: ${e.text} cannot come before FROM (only ARG can)`
          : e.code === 'missing-args'
            ? `line ${e.line}: ${e.text} expects arguments`
            : 'A Dockerfile needs at least one FROM',
    warning: {
      'copy-all-before-install':
        'COPY . . before installing dependencies: every code change busts the install layer cache. Copy only package.json / requirements.txt first, install, then copy the code.',
      'apt-no-cleanup':
        'No /var/lib/apt/lists cleanup after apt-get install: package lists stay in the layer (~40 MB). Add “&& rm -rf /var/lib/apt/lists/*” in the same RUN.',
      'apt-update-alone':
        'apt-get update in its own RUN: a stale package list stays cached and a later install may pull old versions. Combine update and install in one RUN.',
      'latest-tag':
        'Base image is untagged or :latest — builds are not reproducible and the image changes silently. Pin a version (e.g. node:22-alpine) or a digest.',
      'root-user':
        'No USER in the final stage: the container runs as root. A vulnerability means root inside the container; switch to an unprivileged user with USER.',
      'merge-runs':
        'Consecutive RUN lines can be merged: each RUN is a layer; joining related commands with && in one RUN reduces layers and size.',
      'secret-in-env':
        'A secret is baked into the image via ENV/ARG: anyone can read it from the image history (docker history). Use a runtime environment variable or a BuildKit secret.',
      'add-local':
        'Prefer COPY over ADD for local files; ADD has implicit behaviour such as extracting archives and downloading URLs.',
      'pip-cache':
        'pip install runs without --no-cache-dir: pip’s download cache stays in the layer.',
    } satisfies Record<WarningCode, string>,
    line: (n: number) => `line ${n}`,
    compare: 'Before / after',
    before: 'Before (example)',
    after: 'Now (editor)',
    rowSize: 'Final size',
    rowLayers: 'Layers',
    rowWarnings: 'Warnings',
    rowSrc: 'Rebuilt when src/ changes',
    loadAlt: (label: string) => `Load: ${label}`,
    resetExample: 'Back to example',
    sizesNote:
      'Sizes are rough rule-based estimates (base image table, apt/npm/pip rules), not a real build.',
    layerList: 'Layer stack',
  },
};

function fmtMb(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(2)} GB`;
  if (mb < 1) return `${Math.round(mb * 1000)} KB`;
  return `${Math.round(mb)} MB`;
}

const SEVERITY_ICON = { danger: ShieldAlert, warning: AlertTriangle, info: Info } as const;
const STATUS_CLASS = {
  cached: 'border-success/50 bg-success/10',
  rebuilt: 'border-danger/60 bg-danger/15',
  skipped: 'border-border bg-bg/40 opacity-50',
} as const;

function summarize(text: string, contextMb: number) {
  const parsed = parseDockerfile(text);
  return {
    parsed,
    plan: planBuild(parsed, { kind: 'none' }, { contextMb }),
    src: planBuild(parsed, { kind: 'src' }, { contextMb }),
    warnings: lintDockerfile(parsed),
  };
}

export default function DockerLayersSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initialExample = strParam<DockerExampleId>(
    params,
    'example',
    'node-basic',
    DOCKER_EXAMPLES,
  );
  const [example, setExample] = useState<DockerExampleId>(initialExample);
  const [text, setText] = useState(EXAMPLES[initialExample].dockerfile);
  const [contextMb, setContextMb] = useState(numParam(params, 'contextMb', 40, 1, 500));
  const [changeKind, setChangeKind] = useState<Change['kind']>('none');
  const [runLine, setRunLine] = useState<number | null>(null);

  const parsed = useMemo(() => parseDockerfile(text), [text]);
  const runLines = parsed.instructions.filter((i) => i.kind === 'RUN');
  const effectiveRun =
    runLine !== null && runLines.some((r) => r.line === runLine)
      ? runLine
      : (runLines[0]?.line ?? null);
  const change: Change =
    changeKind === 'run'
      ? effectiveRun !== null
        ? { kind: 'run', line: effectiveRun }
        : { kind: 'none' }
      : { kind: changeKind };
  const plan: BuildPlan = useMemo(
    () => planBuild(parsed, change, { contextMb }),
    // change nesnesi her render'da yeniden oluşur; içeriği ile bağımlıyız
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, change.kind, change.line, contextMb],
  );
  const warnings = useMemo(() => lintDockerfile(parsed), [parsed]);
  const before = useMemo(
    () => summarize(EXAMPLES[example].dockerfile, contextMb),
    [example, contextMb],
  );
  const now = useMemo(() => summarize(text, contextMb), [text, contextMb]);
  const maxLayer = Math.max(
    1,
    ...plan.layers.map((x) => x.sizeMb),
    ...plan.stages.map((s) => s.baseMb),
  );

  const interact = () => onInteract();
  const pickExample = (id: DockerExampleId) => {
    interact();
    setExample(id);
    setText(EXAMPLES[id].dockerfile);
    setChangeKind('none');
    setRunLine(null);
  };
  const t = (d: number) => ({ duration: reduced ? 0 : d });

  const barWidth = (mb: number) =>
    `${Math.max(2, Math.round((Math.sqrt(mb) / Math.sqrt(maxLayer)) * 100))}%`;

  const layerRow = (x: LayerInfo) => {
    const ins = x.instruction;
    return (
      <motion.li
        key={`${ins.line}-${ins.kind}`}
        layout={!reduced}
        initial={false}
        animate={{ opacity: 1 }}
        transition={t(0.25)}
        data-status={x.status}
        data-line={ins.line}
        className={cn(
          'rounded-lg border px-2 py-1.5 text-xs',
          ins.createsLayer
            ? STATUS_CLASS[x.status]
            : 'border-dashed border-border bg-transparent text-muted',
          x.cause && 'ring-2 ring-danger',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="w-8 shrink-0 tabular-nums text-muted">{ins.line}</span>
          <span
            className={cn(
              'w-24 shrink-0 font-mono font-semibold',
              ins.createsLayer ? 'text-fg' : 'text-muted',
            )}
          >
            {ins.kind}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono" title={ins.args}>
            {ins.args}
          </span>
          {ins.createsLayer ? (
            <span
              className={cn(
                'shrink-0 font-semibold',
                x.status === 'rebuilt'
                  ? 'text-danger-fg'
                  : x.status === 'cached'
                    ? 'text-success-fg'
                    : 'text-muted',
              )}
            >
              {l.status[x.status]}
            </span>
          ) : (
            <span className="shrink-0">{l.metadata}</span>
          )}
        </div>
        {ins.createsLayer && (
          <div className="mt-1 flex items-center gap-2 pl-10">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/40">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  x.status === 'rebuilt' ? 'bg-danger' : 'bg-success',
                )}
                initial={false}
                animate={{ width: barWidth(x.sizeMb) }}
                transition={t(0.35)}
              />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-muted">
              {fmtMb(x.sizeMb)}
            </span>
          </div>
        )}
        {x.cause && (
          <p className="mt-1 flex items-center gap-1 pl-10 font-semibold text-danger-fg">
            <Zap size={12} /> {l.cause}
          </p>
        )}
      </motion.li>
    );
  };

  const warningItem = (w: DockerWarning, k: number) => {
    const Icon = SEVERITY_ICON[w.severity];
    return (
      <li
        key={`${w.code}-${w.line}-${k}`}
        className={cn(
          'flex gap-2 rounded-lg border p-2 text-xs',
          w.severity === 'danger' && 'border-danger/40 bg-danger/10',
          w.severity === 'warning' && 'border-warning/40 bg-warning/10',
          w.severity === 'info' && 'border-border bg-elevated/50',
        )}
      >
        <Icon
          size={14}
          className={cn(
            'mt-0.5 shrink-0',
            w.severity === 'danger' && 'text-danger-fg',
            w.severity === 'warning' && 'text-warning-fg',
            w.severity === 'info' && 'text-muted',
          )}
        />
        <span>
          <span className="font-semibold">{l.line(w.line)}:</span> {l.warning[w.code]}
        </span>
      </li>
    );
  };

  const cmpRows: { label: string; a: string; b: string; better: boolean | null }[] = [
    {
      label: l.rowSize,
      a: fmtMb(before.plan.finalMb),
      b: fmtMb(now.plan.finalMb),
      better:
        now.plan.finalMb === before.plan.finalMb ? null : now.plan.finalMb < before.plan.finalMb,
    },
    {
      label: l.rowLayers,
      a: String(before.plan.finalLayers),
      b: String(now.plan.finalLayers),
      better:
        now.plan.finalLayers === before.plan.finalLayers
          ? null
          : now.plan.finalLayers < before.plan.finalLayers,
    },
    {
      label: l.rowWarnings,
      a: String(before.warnings.length),
      b: String(now.warnings.length),
      better:
        now.warnings.length === before.warnings.length
          ? null
          : now.warnings.length < before.warnings.length,
    },
    {
      label: l.rowSrc,
      a: fmtMb(before.src.rebuiltMb),
      b: fmtMb(now.src.rebuiltMb),
      better:
        now.src.rebuiltMb === before.src.rebuiltMb
          ? null
          : now.src.rebuiltMb < before.src.rebuiltMb,
    },
  ];
  const alt = EXAMPLES[example].alternative;

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Select
            label={l.example}
            value={example}
            options={DOCKER_EXAMPLES.map((id) => ({ id, label: id }))}
            onChange={pickExample}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.finalSize} value={fmtMb(plan.finalMb)} tone="primary" />
            <Stat label={l.finalLayers} value={plan.finalLayers} />
          </div>
          <Stat
            label={l.rebuilt}
            value={l.rebuiltValue(plan.rebuiltLayers, plan.rebuiltMb)}
            tone={plan.rebuiltLayers > 0 ? 'danger' : 'success'}
          />
          <Range
            label={l.context}
            value={contextMb}
            min={1}
            max={500}
            onChange={(v) => {
              interact();
              setContextMb(v);
            }}
            format={(v) => `${v} MB`}
          />
          <div>
            <p className="label">{l.compare}</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted">
                  <th scope="col" className="py-1 text-left font-medium" />
                  <th scope="col" className="py-1 text-right font-medium">
                    {l.before}
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    {l.after}
                  </th>
                </tr>
              </thead>
              <tbody>
                {cmpRows.map((r) => (
                  <tr key={r.label} className="border-t border-border/60">
                    <th scope="row" className="py-1 text-left font-normal text-muted">
                      {r.label}
                    </th>
                    <td className="py-1 text-right tabular-nums">{r.a}</td>
                    <td
                      className={cn(
                        'py-1 text-right font-semibold tabular-nums',
                        r.better === true && 'text-success-fg',
                        r.better === false && 'text-danger-fg',
                      )}
                    >
                      {r.b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-soft btn-sm"
                onClick={() => {
                  interact();
                  setText(alt.dockerfile);
                  setRunLine(null);
                }}
              >
                <FileCode2 size={14} /> {l.loadAlt(alt.label[locale])}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  interact();
                  setText(EXAMPLES[example].dockerfile);
                  setRunLine(null);
                }}
              >
                <RotateCcw size={14} /> {l.resetExample}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">{l.sizesNote}</p>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="min-w-0 space-y-3">
          <label className="block">
            <span className="label">{l.editor}</span>
            <textarea
              className="input min-h-[320px] font-mono text-xs leading-5"
              value={text}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(e) => {
                interact();
                setText(e.target.value);
              }}
            />
          </label>
          {parsed.errors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 p-2 text-xs"
            >
              <p className="font-semibold text-danger-fg">{l.errors}</p>
              <ul className="mt-1 list-disc pl-4">
                {parsed.errors.map((e) => (
                  <li key={`${e.line}-${e.code}`}>{l.error(e)}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="label">
              {l.warnings} ({warnings.length})
            </p>
            {warnings.length === 0 ? (
              <p className="text-xs text-success-fg">{l.noWarnings}</p>
            ) : (
              <ul className="space-y-1.5">{warnings.map(warningItem)}</ul>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <fieldset className="rounded-xl border border-border bg-bg/60 p-3">
            <legend className="px-1 text-xs font-semibold">{l.cacheSim}</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['none', RotateCcw],
                  ['deps', Package],
                  ['src', FolderGit2],
                  ['run', TerminalSquare],
                ] as const
              ).map(([k, Icon]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={changeKind === k}
                  className={cn('btn-sm', changeKind === k ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => {
                    interact();
                    setChangeKind(k);
                  }}
                  disabled={k === 'run' && runLines.length === 0}
                >
                  <Icon size={14} /> {l.change[k]}
                </button>
              ))}
            </div>
            {changeKind === 'run' && (
              <div className="mt-2 max-w-sm">
                {runLines.length === 0 ? (
                  <p className="text-xs text-muted">{l.noRun}</p>
                ) : (
                  <Select
                    label={l.runLine}
                    value={String(effectiveRun)}
                    options={runLines.map((r) => ({
                      id: String(r.line),
                      label: `${r.line}: RUN ${r.args.length > 48 ? `${r.args.slice(0, 48)}…` : r.args}`,
                    }))}
                    onChange={(v) => {
                      interact();
                      setRunLine(Number(v));
                    }}
                  />
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-muted" aria-live="polite">
              {plan.firstMiss !== undefined ? l.missFrom(plan.firstMiss) : l.allCached}
            </p>
          </fieldset>

          <div aria-label={l.layerList} role="group" className="space-y-3">
            {plan.stages.map((s) => (
              <section
                key={s.stage.index}
                className={cn(
                  'rounded-xl border p-2',
                  s.inFinal ? 'border-primary/50' : 'border-border',
                  !s.used && 'opacity-60',
                )}
              >
                <header className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">{l.stage(s.stage.index, s.stage.name)}</span>
                  <span className={cn('chip', s.inFinal ? 'chip-primary' : '')}>
                    {s.inFinal ? l.finalBadge : s.used ? l.notFinal : l.skipped}
                  </span>
                </header>
                <ol className="space-y-1">
                  <li
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-xs',
                      s.stage.baseStage !== undefined
                        ? 'border-dashed border-border text-muted'
                        : 'border-border bg-elevated/60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0 tabular-nums text-muted">{s.stage.line}</span>
                      <span className="w-24 shrink-0 font-mono font-semibold">FROM</span>
                      <span className="min-w-0 flex-1 truncate font-mono">{s.stage.base}</span>
                      <span className="shrink-0 text-muted">
                        {s.stage.baseStage !== undefined
                          ? l.baseFromStage(
                              plan.stages[s.stage.baseStage]!.stage.name ??
                                String(s.stage.baseStage),
                            )
                          : `${l.base} · ${fmtMb(s.baseMb)}`}
                      </span>
                    </div>
                  </li>
                  {plan.layers.filter((x) => x.instruction.stage === s.stage.index).map(layerRow)}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </div>
    </SimShell>
  );
}
