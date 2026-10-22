'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Field, Select, SimShell } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  FLAGS,
  MAX_PATTERN,
  MAX_TEXT,
  PRESETS,
  PRESET_IDS,
  RISKY_TEXT_LIMIT,
  detectRedos,
  runRegex,
  segments,
  tokenizeRegex,
  type Flag,
  type PresetId,
  type RegexToken,
} from './regexPlayground.logic';

const GROUP_BG = [
  'bg-primary/25',
  'bg-accent/30',
  'bg-success/25',
  'bg-warning/30',
  'bg-danger/20',
];
const GROUP_TEXT = [
  'text-primary',
  'text-accent-fg',
  'text-success',
  'text-warning',
  'text-danger',
];
const groupBg = (g: number) => GROUP_BG[(g - 1) % GROUP_BG.length];
const groupText = (g: number) => GROUP_TEXT[(g - 1) % GROUP_TEXT.length];

const L = {
  tr: {
    title: 'Regex oyun alanı',
    preset: 'Hazır örnek',
    pattern: 'Desen',
    text: 'Test metni',
    flags: 'Bayraklar',
    flagHelp: {
      g: 'g: tüm eşleşmeler',
      i: 'i: büyük/küçük harf duyarsız',
      m: 'm: ^ ve $ her satırda',
      s: 's: . satır sonunu da eşler',
    } satisfies Record<Flag, string>,
    result: 'Eşleşmeler',
    matches: (n: number) => `${n} eşleşme`,
    noMatch: 'Eşleşme yok.',
    group: 'grup',
    explain: 'Desen açıklaması',
    explainError: 'Açıklayıcı bu deseni ayrıştıramadı',
    redos: 'ReDoS riski',
    redosReason: {
      'nested-quantifier':
        'iç içe niceleyici: tekrar eden bir grubun içinde yine sınırsız tekrar var',
      'overlapping-alternation': 'örtüşen seçenekler sınırsız tekrarlanıyor',
    },
    redosHelp: (n: number) =>
      `Eşleşmeyen bir metinde motor, metni parçalara bölmenin üstel sayıda yolunu dener ve sekme donar. Güvende kalmak için desen yalnızca metnin ilk ${n} karakterinde çalıştırıldı. Tekrarı tek seviyeye indir ya da her tekrarı bir ayırıcıyla başlat.`,
    limits: `Sınırlar: desen en fazla ${MAX_PATTERN}, metin en fazla ${MAX_TEXT} karakter; en fazla 500 eşleşme gösterilir. JS'te çalışan bir regex durdurulamaz, bu yüzden boyut sınırlanır.`,
    truncated: 'Sonuçlar kısaltıldı.',
    error: 'Geçersiz desen',
    python: 'Python re ile JS RegExp farkları',
    pythonNotes: [
      'Adlı grup: Python (?P<ad>…), JS (?<ad>…). Geri başvuru: Python (?P=ad), JS \\k<ad>.',
      "Python'da g bayrağı yok: tümü için re.findall / re.finditer, ilki için re.search kullanılır; re.match yalnızca metnin başında arar.",
      'Bayraklar: re.I, re.M, re.S (JS\'te i, m, s). Desenleri r"…" ham metin olarak yaz, yoksa \\\\ kaçışları çiftlenir.',
      "Python'da \\d varsayılan olarak Unicode rakamlarını da eşler (ör. Arapça rakamlar); JS'te yalnızca 0-9. ASCII için re.ASCII.",
      'Geri bakış (lookbehind): Python sabit uzunluk ister, JS değişken uzunluğa izin verir.',
    ],
  },
  en: {
    title: 'Regex playground',
    preset: 'Preset',
    pattern: 'Pattern',
    text: 'Test text',
    flags: 'Flags',
    flagHelp: {
      g: 'g: all matches',
      i: 'i: case-insensitive',
      m: 'm: ^ and $ per line',
      s: 's: . matches newlines too',
    } satisfies Record<Flag, string>,
    result: 'Matches',
    matches: (n: number) => `${n} matches`,
    noMatch: 'No match.',
    group: 'group',
    explain: 'Pattern explanation',
    explainError: 'The explainer could not parse this pattern',
    redos: 'ReDoS risk',
    redosReason: {
      'nested-quantifier': 'nested quantifier: unbounded repetition inside a repeated group',
      'overlapping-alternation': 'overlapping alternatives repeated without bound',
    },
    redosHelp: (n: number) =>
      `On a non-matching input the engine tries an exponential number of ways to split the text and the tab freezes. To stay safe the pattern ran only on the first ${n} characters. Flatten the repetition or start each repetition with a separator.`,
    limits: `Limits: pattern up to ${MAX_PATTERN}, text up to ${MAX_TEXT} characters; at most 500 matches shown. A running JS regex cannot be interrupted, so sizes are capped.`,
    truncated: 'Results truncated.',
    error: 'Invalid pattern',
    python: 'Python re vs JS RegExp',
    pythonNotes: [
      'Named group: Python (?P<name>…), JS (?<name>…). Backreference: Python (?P=name), JS \\k<name>.',
      'Python has no g flag: use re.findall / re.finditer for all, re.search for the first; re.match only matches at the start.',
      'Flags: re.I, re.M, re.S (i, m, s in JS). Write patterns as r"…" raw strings, otherwise backslashes double up.',
      'In Python \\d matches Unicode digits by default (e.g. Arabic-Indic); in JS only 0-9. Use re.ASCII for ASCII.',
      'Lookbehind: Python requires fixed width, JS allows variable width.',
    ],
  },
};

function tokenTone(t: RegexToken): string {
  switch (t.kind) {
    case 'quantifier':
      return 'text-warning';
    case 'group-open':
    case 'group-close':
      return 'text-accent-fg';
    case 'class':
    case 'escape':
    case 'dot':
      return 'text-primary';
    case 'anchor':
    case 'alternation':
      return 'text-danger';
    default:
      return 'text-fg';
  }
}

export default function RegexPlaygroundSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const initial = strParam<PresetId>(params, 'preset', 'log', PRESET_IDS);
  const [preset, setPreset] = useState<PresetId>(initial);
  const [pattern, setPattern] = useState(PRESETS[initial].pattern);
  const [flags, setFlags] = useState<string>(PRESETS[initial].flags);
  const [text, setText] = useState(PRESETS[initial].text);

  const redos = useMemo(() => detectRedos(pattern), [pattern]);
  const risky = redos.length > 0;
  const runText = risky ? text.slice(0, RISKY_TEXT_LIMIT) : text;
  const result = useMemo(() => runRegex(pattern, flags, runText), [pattern, flags, runText]);
  const segs = useMemo(() => segments(runText, result.matches), [runText, result.matches]);

  const explained = useMemo((): { tokens: RegexToken[]; error?: string } => {
    try {
      return { tokens: tokenizeRegex(pattern) };
    } catch (e) {
      return { tokens: [], error: (e as Error).message };
    }
  }, [pattern]);

  const touch = () => onInteract();
  const toggleFlag = (f: Flag) => {
    touch();
    setFlags((cur) =>
      cur.includes(f)
        ? cur.replace(f, '')
        : FLAGS.filter((x) => x === f || cur.includes(x)).join(''),
    );
  };

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <div>
            <p className="label">{l.explain}</p>
            {explained.error ? (
              <p className="text-xs text-danger" data-testid="rx-explain-error">
                {l.explainError}: {explained.error}
              </p>
            ) : (
              <ol className="max-h-72 space-y-1 overflow-auto text-xs" data-testid="rx-explain">
                {explained.tokens.map((t, i) => (
                  <li key={i} style={{ paddingLeft: `${t.depth * 12}px` }} className="flex gap-2">
                    <code
                      className={cn(
                        'shrink-0 rounded bg-bg/70 px-1 font-mono',
                        tokenTone(t),
                        t.group && groupBg(t.group),
                      )}
                    >
                      {t.text}
                    </code>
                    <span className="text-muted">{t.desc[locale]}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div
            className="rounded-xl border border-border bg-elevated/50 p-2"
            data-testid="rx-python"
          >
            <p className="flex items-center gap-1 text-xs font-semibold">
              <Info size={12} /> {l.python}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-4 text-muted">
              {l.pythonNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <Select
          label={l.preset}
          value={preset}
          options={PRESET_IDS.map((id) => ({ id, label: PRESETS[id].label[locale] }))}
          onChange={(v) => {
            touch();
            setPreset(v);
            setPattern(PRESETS[v].pattern);
            setFlags(PRESETS[v].flags);
            setText(PRESETS[v].text);
          }}
        />
        <div>
          <span className="label">{l.flags}</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={l.flags}>
            {FLAGS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={flags.includes(f)}
                title={l.flagHelp[f]}
                className={cn(
                  'h-10 rounded-xl border px-3 font-mono text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  flags.includes(f)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-muted',
                )}
                onClick={() => toggleFlag(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Field label={l.pattern}>
          <div className="flex items-center gap-1 font-mono">
            <span className="text-muted">/</span>
            <input
              className="input font-mono text-sm"
              value={pattern}
              maxLength={MAX_PATTERN}
              spellCheck={false}
              onChange={(e) => {
                touch();
                setPattern(e.target.value);
              }}
            />
            <span className="text-muted">/{flags}</span>
          </div>
        </Field>
      </div>

      {risky && (
        <div
          className="mt-2 flex items-start gap-2 rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-xs"
          role="alert"
          data-testid="rx-redos"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-danger">
              {l.redos}:{' '}
              {redos.map((w) => (
                <code key={w.fragment} className="mr-1 font-mono">
                  {w.fragment}
                </code>
              ))}
            </p>
            <p className="mt-0.5">{l.redosReason[redos[0].reason]}</p>
            <p className="mt-0.5 text-muted">{l.redosHelp(RISKY_TEXT_LIMIT)}</p>
          </div>
        </div>
      )}

      <div className="mt-3">
        <Field label={l.text}>
          <textarea
            className="input min-h-[96px] resize-y font-mono text-xs"
            value={text}
            maxLength={MAX_TEXT}
            spellCheck={false}
            onChange={(e) => {
              touch();
              setText(e.target.value);
            }}
          />
        </Field>
      </div>

      <div className="mt-3">
        <p className="label flex justify-between">
          <span>{l.result}</span>
          {result.ok && <span data-testid="rx-count">{l.matches(result.matches.length)}</span>}
        </p>
        {!result.ok ? (
          <p
            className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger"
            data-testid="rx-error"
          >
            {l.error}: {result.error}
          </p>
        ) : (
          <>
            <pre
              className="whitespace-pre-wrap break-all rounded-xl border border-border bg-bg/60 p-2 font-mono text-xs leading-6"
              data-testid="rx-highlight"
            >
              {segs.map((s, i) =>
                s.match === undefined ? (
                  <span key={i}>{s.text}</span>
                ) : (
                  <mark
                    key={i}
                    data-match={s.match}
                    className={cn(
                      'rounded-sm text-fg underline decoration-primary/60 underline-offset-4',
                      s.group ? groupBg(s.group) : 'bg-primary/10',
                    )}
                  >
                    {s.text}
                  </mark>
                ),
              )}
            </pre>
            {result.matches.length === 0 ? (
              <p className="mt-1 text-xs text-muted">{l.noMatch}</p>
            ) : (
              <ol
                className="mt-2 max-h-48 space-y-1 overflow-auto text-xs"
                data-testid="rx-matches"
              >
                {result.matches.slice(0, 50).map((m, i) => (
                  <li key={i} className="rounded-lg border border-border px-2 py-1">
                    <span className="font-mono text-muted">
                      #{i + 1} [{m.start}–{m.end}]
                    </span>{' '}
                    <span className="font-mono">{m.text || '∅'}</span>
                    {m.groups.length > 0 && (
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {m.groups.map((g) => (
                          <span key={g.index} className={cn('font-mono', groupText(g.index))}>
                            {g.name ?? `${l.group} ${g.index}`}: {JSON.stringify(g.text)}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {result.truncated && <p className="mt-1 text-xs text-warning">{l.truncated}</p>}
          </>
        )}
        <p className="mt-2 text-[11px] text-muted">{l.limits}</p>
      </div>
    </SimShell>
  );
}
