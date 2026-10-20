'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Play, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Field, LogList, Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  PRESET_TEMPLATES,
  PROMPT_PRESETS,
  detectInjection,
  runPrompt,
  type FewShot,
  type PromptPreset,
  type PromptRunResult,
} from './promptPlayground.logic';

const L = {
  tr: {
    title: 'Prompt oyun alanı',
    preset: 'Görev şablonu',
    presets: {
      summarize: 'Özetle',
      extract: 'Bilgi çıkar',
      classify: 'Sınıflandır',
      injection: 'Prompt enjeksiyonu',
    } satisfies Record<PromptPreset, string>,
    temperature: 'Sıcaklık',
    seed: 'Tohum',
    reroll: 'Yeni tohum',
    system: 'Sistem promptu',
    input: 'Kullanıcı girdisi',
    run: 'Çalıştır',
    output: 'Model çıktısı (simüle)',
    notRun: 'Henüz çalıştırılmadı. “Çalıştır”a bas.',
    stale: 'Girdiler değişti; sonucu görmek için yeniden çalıştır.',
    json: 'Yapılandırılmış çıktı (JSON)',
    guardrail: 'Enjeksiyon koruması (guardrail)',
    fewShot: 'Few-shot örnekler',
    exIn: 'Örnek girdi',
    exOut: 'Beklenen çıktı',
    add: 'Örnek ekle',
    remove: 'Örneği sil',
    noShots: 'Örnek yok (zero-shot).',
    tokensIn: 'Girdi token',
    tokensOut: 'Çıktı token',
    swaps: 'Eş anlamlı değişim',
    trace: 'Kural izi',
    detected: 'Girdide enjeksiyon kalıbı',
    refused: 'Guardrail enjeksiyonu reddetti',
    leaked: 'Korumasız: sistem promptu sızdı',
    hint: 'Bu bir dil modeli değil: kurallarla çalışan, deterministik bir benzetim. Sıcaklık arttıkça aynı tohumla bile bazı kelimeler eş anlamlılarıyla değişir; tohum aynıysa çıktı birebir tekrarlanır.',
    shotHint: {
      summarize: 'Kısa çıktılı örnekler eklersen özet de kısalır.',
      extract: 'Çıkarım düzenli ifadelerle yapılır; örnekler sonucu değiştirmez.',
      classify:
        'Örnek çıktısına “olumlu/olumsuz/nötr” yaz: girdideki kelimeler o etikete ağırlık ekler.',
      injection: 'Guardrail’i kapatıp yeniden çalıştır: model gizli kodu sızdırır.',
    } satisfies Record<PromptPreset, string>,
  },
  en: {
    title: 'Prompt playground',
    preset: 'Task preset',
    presets: {
      summarize: 'Summarise',
      extract: 'Extract',
      classify: 'Classify',
      injection: 'Prompt injection',
    } satisfies Record<PromptPreset, string>,
    temperature: 'Temperature',
    seed: 'Seed',
    reroll: 'New seed',
    system: 'System prompt',
    input: 'User input',
    run: 'Run',
    output: 'Model output (simulated)',
    notRun: 'Not run yet. Press “Run”.',
    stale: 'Inputs changed; run again to see the result.',
    json: 'Structured output (JSON)',
    guardrail: 'Injection guardrail',
    fewShot: 'Few-shot examples',
    exIn: 'Example input',
    exOut: 'Expected output',
    add: 'Add example',
    remove: 'Remove example',
    noShots: 'No examples (zero-shot).',
    tokensIn: 'Input tokens',
    tokensOut: 'Output tokens',
    swaps: 'Synonym swaps',
    trace: 'Rule trace',
    detected: 'Injection pattern in input',
    refused: 'Guardrail refused the injection',
    leaked: 'Unprotected: system prompt leaked',
    hint: 'This is not a language model: it is a deterministic, rule-based simulation. Higher temperature swaps some words for synonyms; with the same seed the output repeats exactly.',
    shotHint: {
      summarize: 'Add examples with short outputs and the summary gets shorter.',
      extract: 'Extraction uses regular expressions; examples do not change it.',
      classify:
        'Write “positive/negative/neutral” as the output: the input words add weight to that label.',
      injection: 'Turn the guardrail off and run again: the model leaks the secret code.',
    } satisfies Record<PromptPreset, string>,
  },
};

export default function PromptPlaygroundSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [preset, setPreset] = useState<PromptPreset>(() =>
    strParam(params, 'preset', 'summarize', PROMPT_PRESETS),
  );
  const [temperature, setTemperature] = useState(() => numParam(params, 'temperature', 0, 0, 1));
  const [system, setSystem] = useState(() => PRESET_TEMPLATES[locale][preset].system);
  const [input, setInput] = useState(() => PRESET_TEMPLATES[locale][preset].input);
  const [seed, setSeed] = useState(1);
  const [json, setJson] = useState(false);
  const [guardrail, setGuardrail] = useState(true);
  const [shots, setShots] = useState<FewShot[]>([]);
  const [draft, setDraft] = useState<FewShot>({ input: '', output: '' });
  const [result, setResult] = useState<PromptRunResult | null>(null);
  const [ranKey, setRanKey] = useState('');

  const key = JSON.stringify([preset, temperature, system, input, seed, json, guardrail, shots]);
  const stale = result !== null && ranKey !== key;
  const live = detectInjection(input);

  const run = (nextSeed = seed) => {
    onInteract();
    setResult(
      runPrompt({
        preset,
        system,
        input,
        temperature,
        seed: nextSeed,
        fewShots: shots,
        json,
        guardrail,
        locale,
      }),
    );
    setRanKey(
      JSON.stringify([preset, temperature, system, input, nextSeed, json, guardrail, shots]),
    );
  };

  const choosePreset = (p: PromptPreset) => {
    onInteract();
    setPreset(p);
    setSystem(PRESET_TEMPLATES[locale][p].system);
    setInput(PRESET_TEMPLATES[locale][p].input);
    setShots([]);
    setResult(null);
  };

  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--da-primary)]"
        checked={value}
        onChange={(e) => {
          onInteract();
          set(e.target.checked);
        }}
      />
    </label>
  );

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={() => run()}>
            <Play size={14} /> {l.run}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const s = seed + 1;
              setSeed(s);
              run(s);
            }}
          >
            <Dices size={14} /> {l.reroll}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.preset}
            value={preset}
            options={PROMPT_PRESETS.map((p) => ({ id: p, label: l.presets[p] }))}
            onChange={choosePreset}
          />
          <Range
            label={l.temperature}
            value={temperature}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => {
              onInteract();
              setTemperature(v);
            }}
          />
          {toggle(l.json, json, setJson)}
          {toggle(l.guardrail, guardrail, setGuardrail)}
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.tokensIn} value={result?.tokensIn ?? '—'} />
            <Stat label={l.tokensOut} value={result?.tokensOut ?? '—'} />
            <Stat label={l.swaps} value={result?.swaps ?? '—'} tone="primary" />
            <Stat label={l.seed} value={seed} />
          </div>
          <div>
            <p className="label">{l.trace}</p>
            <LogList
              items={(result?.trace ?? []).map((t, i) => ({ key: i, text: t, tone: 'muted' }))}
            />
          </div>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{l.hint}</p>
      <div className="grid gap-3">
        <Field label={l.system}>
          <textarea
            className="input min-h-[64px] resize-y font-mono text-xs"
            value={system}
            onChange={(e) => {
              onInteract();
              setSystem(e.target.value);
            }}
          />
        </Field>

        <div className="rounded-xl border border-border bg-surface/80 p-3">
          <p className="label">{l.fewShot}</p>
          <p className="mb-2 text-xs text-muted">{l.shotHint[preset]}</p>
          {shots.length === 0 ? (
            <p className="mb-2 text-xs text-muted">{l.noShots}</p>
          ) : (
            <ul className="mb-2 space-y-1">
              {shots.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-lg bg-elevated/60 px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-0">
                    <span className="text-muted">in:</span> {s.input}{' '}
                    <span className="text-muted">→ out:</span> {s.output}
                  </span>
                  <button
                    type="button"
                    className="btn-icon btn-icon-sm shrink-0"
                    aria-label={l.remove}
                    onClick={() => {
                      onInteract();
                      setShots((xs) => xs.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              className="input text-xs"
              placeholder={l.exIn}
              aria-label={l.exIn}
              value={draft.input}
              onChange={(e) => setDraft((d) => ({ ...d, input: e.target.value }))}
            />
            <input
              className="input text-xs"
              placeholder={l.exOut}
              aria-label={l.exOut}
              value={draft.output}
              onChange={(e) => setDraft((d) => ({ ...d, output: e.target.value }))}
            />
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={!draft.input.trim() || !draft.output.trim()}
              onClick={() => {
                onInteract();
                setShots((xs) => [
                  ...xs,
                  { input: draft.input.trim(), output: draft.output.trim() },
                ]);
                setDraft({ input: '', output: '' });
              }}
            >
              <Plus size={14} /> {l.add}
            </button>
          </div>
        </div>

        <Field label={l.input}>
          <textarea
            className="input min-h-[88px] resize-y"
            value={input}
            onChange={(e) => {
              onInteract();
              setInput(e.target.value);
            }}
          />
        </Field>
        {live.length > 0 && (
          <p className="flex items-center gap-2 text-xs text-warning">
            <ShieldAlert size={14} /> {l.detected}: {live.join(', ')}
          </p>
        )}

        <div>
          <p className="label flex items-center gap-2">
            {l.output}
            {result?.refused && (
              <span className="chip chip-primary inline-flex items-center gap-1 text-xs text-success">
                <ShieldCheck size={13} /> {l.refused}
              </span>
            )}
            {result && result.injections.length > 0 && !result.refused && (
              <span className="inline-flex items-center gap-1 text-xs text-danger">
                <ShieldAlert size={13} /> {l.leaked}
              </span>
            )}
          </p>
          <motion.pre
            key={result ? ranKey : 'empty'}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            data-testid="prompt-output"
            aria-live="polite"
            className={cn(
              'min-h-[72px] whitespace-pre-wrap rounded-xl border p-3 font-mono text-xs leading-5',
              result && result.injections.length > 0 && !result.refused
                ? 'border-danger/50 bg-danger/5'
                : 'border-primary/40 bg-primary/5',
            )}
          >
            {result ? result.output : l.notRun}
          </motion.pre>
          {stale && <p className="mt-1 text-xs text-warning">{l.stale}</p>}
        </div>
      </div>
    </SimShell>
  );
}
