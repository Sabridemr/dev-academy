'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn, formatPercent } from '@/lib/utils';
import { Range, Select, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  COST_MODELS,
  PRICES,
  contextFill,
  formatUsd,
  requestCost,
  scenarios,
  type CostModel,
  type ScenarioId,
} from './tokenCost.logic';

const L = {
  tr: {
    title: 'Token maliyeti ve tasarruf senaryoları',
    model: 'Model',
    models: { small: 'Küçük model', mid: 'Orta model', large: 'Büyük model' } satisfies Record<
      CostModel,
      string
    >,
    inputTokens: 'Girdi token / istek',
    outputTokens: 'Çıktı token / istek',
    requestsPerDay: 'İstek / gün',
    prefix: 'Sabit önek (önbelleğe alınabilir)',
    hitRate: 'Önbellek isabet oranı',
    routed: 'Küçük modele yönlendirilen',
    disclaimer:
      'Örnek fiyatlar: temsili değerlerdir, hiçbir sağlayıcının gerçek fiyatı değildir. Önbellekten okunan girdi %10 fiyatla sayılır.',
    perM: '1M token başına',
    in: 'Girdi',
    out: 'Çıktı',
    cached: 'Önbellek',
    ctx: 'Bağlam',
    perRequest: 'İstek başı',
    daily: 'Günlük',
    monthly: 'Aylık (30 gün)',
    chart: 'Aylık maliyet: senaryo karşılaştırması',
    scen: {
      baseline: 'Taban',
      cache: 'Prompt önbelleği',
      routing: 'Yönlendirme',
      both: 'İkisi birlikte',
    } satisfies Record<ScenarioId, string>,
    save: 'tasarruf',
    fill: 'Bağlam penceresi doluluğu',
    overflow: 'Bağlam penceresi aşıldı: istek reddedilir ya da kırpılır.',
    nearFull: 'Pencere dolmak üzere: geçmişi özetlemeyi ya da RAG ile kısaltmayı düşün.',
    routingSmall: 'Zaten küçük model seçili; yönlendirme ek tasarruf sağlamaz.',
  },
  en: {
    title: 'Token cost and savings scenarios',
    model: 'Model',
    models: { small: 'Small model', mid: 'Mid model', large: 'Large model' } satisfies Record<
      CostModel,
      string
    >,
    inputTokens: 'Input tokens / request',
    outputTokens: 'Output tokens / request',
    requestsPerDay: 'Requests / day',
    prefix: 'Static prefix (cacheable)',
    hitRate: 'Cache hit rate',
    routed: 'Routed to small model',
    disclaimer:
      'Sample prices: illustrative values, not any provider’s real pricing. Cached input is billed at 10%.',
    perM: 'per 1M tokens',
    in: 'Input',
    out: 'Output',
    cached: 'Cached',
    ctx: 'Context',
    perRequest: 'Per request',
    daily: 'Daily',
    monthly: 'Monthly (30 days)',
    chart: 'Monthly cost: scenario comparison',
    scen: {
      baseline: 'Baseline',
      cache: 'Prompt cache',
      routing: 'Routing',
      both: 'Both',
    } satisfies Record<ScenarioId, string>,
    save: 'saved',
    fill: 'Context window usage',
    overflow: 'Context window exceeded: the request is rejected or truncated.',
    nearFull: 'Window nearly full: consider summarising history or trimming with RAG.',
    routingSmall: 'The small model is already selected; routing adds no savings.',
  },
};

const fmtInt = (v: number, locale: string) =>
  new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US').format(Math.round(v));

export default function TokenCostSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [model, setModel] = useState<CostModel>(() =>
    strParam(params, 'model', 'mid', COST_MODELS),
  );
  const [inputTokens, setInputTokens] = useState(() =>
    numParam(params, 'inputTokens', 2000, 100, 200_000),
  );
  const [outputTokens, setOutputTokens] = useState(() =>
    numParam(params, 'outputTokens', 500, 10, 16_000),
  );
  const [requestsPerDay, setRequestsPerDay] = useState(() =>
    numParam(params, 'requestsPerDay', 1000, 10, 100_000),
  );
  const [prefix, setPrefix] = useState(0.6);
  const [hitRate, setHitRate] = useState(0.8);
  const [routed, setRouted] = useState(0.5);

  const touch = (set: (v: number) => void) => (v: number) => {
    onInteract();
    set(v);
  };
  const usage = { inputTokens, outputTokens, requestsPerDay };
  const list = useMemo(
    () =>
      scenarios(
        model,
        { inputTokens, outputTokens, requestsPerDay },
        { cacheablePrefix: prefix, cacheHitRate: hitRate, routedShare: routed },
      ),
    [model, inputTokens, outputTokens, requestsPerDay, prefix, hitRate, routed],
  );
  const base = list[0];
  const per = requestCost(model, usage.inputTokens, usage.outputTokens);
  const fill = contextFill(model, inputTokens, outputTokens);
  const fillTone =
    fill > 1 ? 'var(--da-danger)' : fill > 0.8 ? 'var(--da-warning)' : 'var(--da-success)';
  const maxMonthly = Math.max(...list.map((s) => s.monthly), 1e-9);
  const pct = (v: number) => formatPercent(v * 100, locale);

  const W = 560;
  const barH = 34;
  const labelW = 130;
  const chartW = W - labelW - 120;

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Select
            label={l.model}
            value={model}
            options={COST_MODELS.map((m) => ({ id: m, label: l.models[m] }))}
            onChange={(v) => {
              onInteract();
              setModel(v);
            }}
          />
          <Range
            label={l.inputTokens}
            value={inputTokens}
            min={100}
            max={200_000}
            step={100}
            format={(v) => fmtInt(v, locale)}
            onChange={touch(setInputTokens)}
          />
          <Range
            label={l.outputTokens}
            value={outputTokens}
            min={10}
            max={16_000}
            step={10}
            format={(v) => fmtInt(v, locale)}
            onChange={touch(setOutputTokens)}
          />
          <Range
            label={l.requestsPerDay}
            value={requestsPerDay}
            min={10}
            max={100_000}
            step={10}
            format={(v) => fmtInt(v, locale)}
            onChange={touch(setRequestsPerDay)}
          />
          <Range
            label={l.prefix}
            value={prefix}
            min={0}
            max={1}
            step={0.05}
            format={pct}
            onChange={touch(setPrefix)}
          />
          <Range
            label={l.hitRate}
            value={hitRate}
            min={0}
            max={1}
            step={0.05}
            format={pct}
            onChange={touch(setHitRate)}
          />
          <Range
            label={l.routed}
            value={routed}
            min={0}
            max={1}
            step={0.05}
            format={pct}
            onChange={touch(setRouted)}
          />
          {model === 'small' && <p className="text-xs text-muted">{l.routingSmall}</p>}
        </>
      }
    >
      <p className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {l.disclaimer}
      </p>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">
                {l.model} <span className="font-normal">({l.perM})</span>
              </th>
              <th className="py-1 pr-2 font-medium">{l.in}</th>
              <th className="py-1 pr-2 font-medium">{l.out}</th>
              <th className="py-1 pr-2 font-medium">{l.cached}</th>
              <th className="py-1 font-medium">{l.ctx}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {COST_MODELS.map((m) => (
              <tr
                key={m}
                className={cn(
                  'cursor-pointer border-t border-border',
                  m === model && 'bg-primary/10 font-semibold',
                )}
                onClick={() => {
                  onInteract();
                  setModel(m);
                }}
              >
                <td className="py-1.5 pr-2">{l.models[m]}</td>
                <td className="py-1.5 pr-2">{formatUsd(PRICES[m].input, locale)}</td>
                <td className="py-1.5 pr-2">{formatUsd(PRICES[m].output, locale)}</td>
                <td className="py-1.5 pr-2">{formatUsd(PRICES[m].cachedInput, locale)}</td>
                <td className="py-1.5">{fmtInt(PRICES[m].context, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label={l.perRequest} value={formatUsd(per, locale)} />
        <Stat label={l.daily} value={formatUsd(base.daily, locale)} />
        <Stat label={l.monthly} value={formatUsd(base.monthly, locale)} tone="primary" />
      </div>

      <p className="label">{l.chart}</p>
      <svg
        viewBox={`0 0 ${W} ${list.length * (barH + 12) + 8}`}
        className="mb-4 h-auto w-full"
        role="img"
        aria-label={l.chart}
      >
        {list.map((s, i) => {
          const y = 4 + i * (barH + 12);
          const w = Math.max(2, (s.monthly / maxMonthly) * chartW);
          const color =
            s.id === 'baseline'
              ? 'var(--da-muted)'
              : s.id === 'both'
                ? 'var(--da-success)'
                : 'var(--da-primary)';
          return (
            <g key={s.id}>
              <text x={0} y={y + barH / 2 + 4} fontSize={13} fill="var(--da-fg)">
                {l.scen[s.id]}
              </text>
              <rect
                x={labelW}
                y={y}
                width={chartW}
                height={barH}
                rx={8}
                fill="var(--da-elevated)"
              />
              <motion.rect
                x={labelW}
                y={y}
                height={barH}
                rx={8}
                fill={color}
                opacity={0.85}
                initial={false}
                animate={{ width: w }}
                transition={{ duration: reduced ? 0 : 0.3 }}
              />
              <text
                x={labelW + chartW + 8}
                y={y + 14}
                fontSize={13}
                fontWeight={600}
                fill="var(--da-fg)"
              >
                {formatUsd(s.monthly, locale)}
              </text>
              {s.id !== 'baseline' && (
                <text
                  x={labelW + chartW + 8}
                  y={y + 30}
                  fontSize={12}
                  fill={s.savings > 0 ? 'var(--da-success)' : 'var(--da-muted)'}
                >
                  −{pct(s.savings)} {l.save}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="label flex justify-between">
        <span>{l.fill}</span>
        <span className="tabular-nums text-fg">
          {fmtInt(inputTokens + outputTokens, locale)} / {fmtInt(PRICES[model].context, locale)} (
          {formatPercent(Math.min(fill, 1) * 100, locale)}
          {fill > 1 ? '+' : ''})
        </span>
      </p>
      <div
        className="h-3 overflow-hidden rounded-full bg-elevated"
        role="meter"
        aria-label={l.fill}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(fill, 1) * 100)}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: fillTone }}
          initial={false}
          animate={{ width: `${Math.min(fill, 1) * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.3 }}
        />
      </div>
      {fill > 1 ? (
        <p className="mt-1 text-xs text-danger">{l.overflow}</p>
      ) : fill > 0.8 ? (
        <p className="mt-1 text-xs text-warning">{l.nearFull}</p>
      ) : null}
    </SimShell>
  );
}
