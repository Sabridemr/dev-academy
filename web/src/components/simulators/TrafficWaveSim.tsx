'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, SimShell, Stat } from './ui';
import { boolParam, numParam, type SimulatorProps } from './types';

const MINUTES = 24 * 60;
const SPIKE_START = 19 * 60; // 19:00 "Black Friday" kampanyası
const COST_PER_INSTANCE_HOUR = 0.4;
const COLD_BOOT_SEC = 180;
const WARM_BOOT_SEC = 10;

interface SimResult {
  demand: number[];
  capacity: number[];
  served: number[];
  queued: number[];
  dropped: number[];
  instances: number[];
  totalDropped: number;
  totalDemand: number;
  maxQueue: number;
  cost: number;
  peakInstances: number;
  maxWaitSec: number;
}

const L = {
  tr: {
    title: 'Trafik dalgası: Black Friday günü',
    baseline: 'Taban trafik (istek/sn)',
    peak: 'Tepe çarpanı',
    ramp: 'Yükselme süresi (sn)',
    autoscale: 'Otomatik ölçekleme',
    delay: 'Ölçekleme gecikmesi (sn)',
    warm: 'Sıcak havuz (hazır instance)',
    queue: 'Sipariş kuyruğu (fazlayı beklet)',
    fixed: 'Sabit instance sayısı',
    perInstance: 'Instance kapasitesi',
    dropped: 'Düşen istek',
    dropPct: 'Düşme oranı',
    maxQueue: 'Maks. kuyruk',
    wait: 'Maks. bekleme',
    cost: 'Günlük maliyet',
    peakInst: 'Tepe instance',
    chart: 'Talep ve kapasite (24 saat)',
    demand: 'talep',
    capacity: 'kapasite',
    play: 'Günü oynat',
    pause: 'Duraklat',
    now: 'Saat',
    note: 'Ani artışta otomatik ölçekleme gecikmeli tepki verir (algılama + instance açılışı). Sıcak havuz açılış süresini kısaltır, kuyruk ise istekleri düşürmek yerine bekletir — ama bekleme süresi artar.',
  },
  en: {
    title: 'Traffic wave: Black Friday',
    baseline: 'Baseline traffic (req/s)',
    peak: 'Peak multiplier',
    ramp: 'Ramp time (s)',
    autoscale: 'Autoscaling',
    delay: 'Scale-up delay (s)',
    warm: 'Warm pool (ready instances)',
    queue: 'Order queue (buffer excess)',
    fixed: 'Fixed instance count',
    perInstance: 'Instance capacity',
    dropped: 'Dropped requests',
    dropPct: 'Drop rate',
    maxQueue: 'Max queue',
    wait: 'Max wait',
    cost: 'Daily cost',
    peakInst: 'Peak instances',
    chart: 'Demand and capacity (24 hours)',
    demand: 'demand',
    capacity: 'capacity',
    play: 'Play the day',
    pause: 'Pause',
    now: 'Time',
    note: 'On a sudden spike autoscaling reacts late (detection + instance boot). A warm pool shortens boot time; a queue holds requests instead of dropping them — at the cost of longer waits.',
  },
};

/** Dakika çözünürlüğünde 24 saatlik simülasyon (saf fonksiyon) */
function simulate(o: {
  baseline: number;
  peak: number;
  rampSec: number;
  autoscale: boolean;
  delaySec: number;
  warm: number;
  queueEnabled: boolean;
  fixed: number;
  perInstance: number;
}): SimResult {
  const r: SimResult = {
    demand: [],
    capacity: [],
    served: [],
    queued: [],
    dropped: [],
    instances: [],
    totalDropped: 0,
    totalDemand: 0,
    maxQueue: 0,
    cost: 0,
    peakInstances: 0,
    maxWaitSec: 0,
  };
  const rampMin = Math.max(1, o.rampSec / 60);
  let instances = o.autoscale
    ? Math.max(2, Math.ceil(o.baseline / (o.perInstance * 0.7)))
    : o.fixed;
  let queue = 0;
  const queueCap = o.baseline * 60 * 10; // ~10 dakikalık taban trafik
  // Bekleyen ölçek artışları: [hazır olacağı dakika, adet]
  const pending: { readyAt: number; count: number }[] = [];
  for (let m = 0; m < MINUTES; m++) {
    const h = m / 60;
    const diurnal = 0.55 + 0.45 * Math.sin(((h - 8) / 24) * Math.PI * 2);
    let spike = 0;
    if (m >= SPIKE_START) {
      const t = m - SPIKE_START;
      if (t < rampMin) spike = t / rampMin;
      else if (t < rampMin + 90) spike = 1;
      else spike = Math.max(0, 1 - (t - rampMin - 90) / 150);
    }
    const demand = o.baseline * diurnal + o.baseline * (o.peak - 1) * spike;
    // Ölçek artışlarını uygula
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].readyAt <= m) {
        instances += pending[i].count;
        pending.splice(i, 1);
      }
    }
    if (o.autoscale) {
      const inFlight = pending.reduce((a, p) => a + p.count, 0);
      const desired = Math.max(2, Math.ceil((demand + queue / 60) / (o.perInstance * 0.7)));
      if (desired > instances + inFlight) {
        const need = desired - instances - inFlight;
        const fromWarm = Math.min(need, o.warm);
        const cold = need - fromWarm;
        if (fromWarm > 0)
          pending.push({
            readyAt: m + Math.ceil((o.delaySec + WARM_BOOT_SEC) / 60),
            count: fromWarm,
          });
        if (cold > 0)
          pending.push({ readyAt: m + Math.ceil((o.delaySec + COLD_BOOT_SEC) / 60), count: cold });
      } else if (desired < instances - 1 && m % 10 === 0) {
        instances = Math.max(desired, instances - Math.ceil(instances * 0.1)); // yavaş küçülme
      }
    }
    const capacity = instances * o.perInstance;
    let served = Math.min(capacity, demand + queue);
    const excess = demand + queue - served;
    let dropped = 0;
    if (o.queueEnabled) {
      queue = Math.min(queueCap, excess);
      dropped = Math.max(0, excess - queueCap);
    } else {
      queue = 0;
      dropped = excess;
    }
    served = Math.max(0, served);
    r.demand.push(demand);
    r.capacity.push(capacity);
    r.served.push(served);
    r.queued.push(queue);
    r.dropped.push(dropped);
    r.instances.push(instances);
    r.totalDropped += dropped * 60;
    r.totalDemand += demand * 60;
    r.maxQueue = Math.max(r.maxQueue, queue * 60);
    r.maxWaitSec = Math.max(r.maxWaitSec, capacity > 0 ? (queue * 60) / capacity : 0);
    r.cost +=
      (instances * COST_PER_INSTANCE_HOUR) / 60 +
      (o.autoscale ? (o.warm * COST_PER_INSTANCE_HOUR * 0.25) / 60 : 0);
    r.peakInstances = Math.max(r.peakInstances, instances);
  }
  return r;
}

export default function TrafficWaveSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [baseline, setBaseline] = useState(() =>
    numParam(params, 'baselineRps', 5000, 100, 100000),
  );
  const [peak, setPeak] = useState(() => numParam(params, 'peakMultiplier', 12, 1, 30));
  const [rampSec, setRampSec] = useState(() => numParam(params, 'rampSeconds', 60, 10, 3600));
  const [autoscale, setAutoscale] = useState(() => boolParam(params, 'autoscale', true));
  const [delaySec, setDelaySec] = useState(() =>
    numParam(params, 'scaleUpDelaySeconds', 90, 0, 600),
  );
  const [warm, setWarm] = useState(0);
  const [queueEnabled, setQueueEnabled] = useState(() => boolParam(params, 'queueEnabled', false));
  const perInstance = Math.max(50, Math.round(baseline / 4));
  const [fixed, setFixed] = useState(8);
  const [cursor, setCursor] = useState(MINUTES - 1);
  const [playing, setPlaying] = useState(false);

  const sim = useMemo(
    () =>
      simulate({
        baseline,
        peak,
        rampSec,
        autoscale,
        delaySec,
        warm,
        queueEnabled,
        fixed,
        perInstance,
      }),
    [baseline, peak, rampSec, autoscale, delaySec, warm, queueEnabled, fixed, perInstance],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setCursor((c) => Math.min(MINUTES - 1, c + 10)), 40);
    return () => clearInterval(id);
  }, [playing]);

  // Gün sonuna gelince oynatmayı durdur
  useEffect(() => {
    if (playing && cursor >= MINUTES - 1) setPlaying(false);
  }, [playing, cursor]);

  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US');
  const maxY = Math.max(...sim.demand, ...sim.capacity) * 1.05;
  const X = (m: number) => 40 + (m / (MINUTES - 1)) * 550;
  const Y = (v: number) => 180 - (v / maxY) * 160;
  const step = 4; // çizim için örnekleme (360 nokta)
  const upTo = cursor;
  const pts = (arr: number[]) =>
    arr
      .map((v, m) => (m % step === 0 && m <= upTo ? `${X(m).toFixed(1)},${Y(v).toFixed(1)}` : null))
      .filter(Boolean)
      .join(' ');
  // Düşen istekleri alan olarak göster: talep ile kapasite arasındaki fark (kuyruk yoksa)
  const lossArea = sim.demand
    .map((d, m) => ({ m, d, c: sim.capacity[m] }))
    .filter((p) => p.m % step === 0 && p.m <= upTo)
    .map((p) => `${X(p.m).toFixed(1)},${Y(Math.max(p.d, p.c)).toFixed(1)}`);
  const capLine = sim.capacity
    .map((c, m) => ({ m, c }))
    .filter((p) => p.m % step === 0 && p.m <= upTo)
    .reverse()
    .map((p) => `${X(p.m).toFixed(1)},${Y(p.c).toFixed(1)}`);
  const hh = Math.floor(cursor / 60);
  const mm = cursor % 60;
  const dropPct = sim.totalDemand > 0 ? (sim.totalDropped / sim.totalDemand) * 100 : 0;
  const interact = () => onInteract();

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button
          type="button"
          className="btn-primary"
          aria-pressed={playing}
          onClick={() => {
            interact();
            if (reduced) {
              setCursor(MINUTES - 1);
              return;
            }
            if (!playing && cursor >= MINUTES - 1) setCursor(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.play}
        </button>
      }
      aside={
        <>
          <Range
            label={l.baseline}
            value={baseline}
            min={500}
            max={20000}
            step={500}
            onChange={(v) => {
              interact();
              setBaseline(v);
            }}
          />
          <Range
            label={l.peak}
            value={peak}
            min={1}
            max={30}
            format={(v) => `${v}×`}
            onChange={(v) => {
              interact();
              setPeak(v);
            }}
          />
          <Range
            label={l.ramp}
            value={rampSec}
            min={10}
            max={1800}
            step={10}
            format={(v) => `${v}s`}
            onChange={(v) => {
              interact();
              setRampSec(v);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoscale}
              onChange={(e) => {
                interact();
                setAutoscale(e.target.checked);
              }}
            />{' '}
            {l.autoscale}
          </label>
          {autoscale ? (
            <>
              <Range
                label={l.delay}
                value={delaySec}
                min={0}
                max={600}
                step={15}
                format={(v) => `${v}s`}
                onChange={(v) => {
                  interact();
                  setDelaySec(v);
                }}
              />
              <Range
                label={l.warm}
                value={warm}
                min={0}
                max={60}
                onChange={(v) => {
                  interact();
                  setWarm(v);
                }}
              />
            </>
          ) : (
            <Range
              label={l.fixed}
              value={fixed}
              min={1}
              max={80}
              onChange={(v) => {
                interact();
                setFixed(v);
              }}
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={queueEnabled}
              onChange={(e) => {
                interact();
                setQueueEnabled(e.target.checked);
              }}
            />{' '}
            {l.queue}
          </label>
          <p className="text-xs text-muted">
            {l.perInstance}: {fmt(perInstance)} req/s
          </p>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite">
        <Stat
          label={l.dropped}
          value={fmt(sim.totalDropped)}
          tone={sim.totalDropped > 0 ? 'danger' : 'success'}
        />
        <Stat
          label={l.dropPct}
          value={`${dropPct.toFixed(2)}%`}
          tone={dropPct > 1 ? 'danger' : dropPct > 0 ? 'warning' : 'success'}
        />
        <Stat label={l.cost} value={`$${sim.cost.toFixed(0)}`} />
        <Stat label={l.peakInst} value={sim.peakInstances} tone="primary" />
        <Stat
          label={l.maxQueue}
          value={fmt(sim.maxQueue)}
          tone={sim.maxQueue > 0 ? 'warning' : undefined}
        />
        <Stat label={l.wait} value={`${sim.maxWaitSec.toFixed(0)}s`} />
      </div>
      <figure className="mt-3">
        <figcaption className="label">
          {l.chart} · {l.now} {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')} ·{' '}
          {fmt(sim.demand[cursor])} / {fmt(sim.capacity[cursor])} req/s · {sim.instances[cursor]}{' '}
          inst.
        </figcaption>
        <svg viewBox="0 0 600 210" className="h-auto w-full" role="img" aria-label={l.chart}>
          <rect
            x={40}
            y={20}
            width={550}
            height={160}
            fill="var(--da-bg)"
            stroke="var(--da-border)"
          />
          {[0, 6, 12, 18, 24].map((hr) => (
            <g key={hr}>
              <line
                x1={X(Math.min(MINUTES - 1, hr * 60))}
                x2={X(Math.min(MINUTES - 1, hr * 60))}
                y1={20}
                y2={180}
                stroke="var(--da-border)"
                strokeDasharray="2 4"
              />
              <text
                x={X(Math.min(MINUTES - 1, hr * 60))}
                y={194}
                textAnchor="middle"
                fontSize={10}
                fill="var(--da-muted)"
              >
                {String(hr).padStart(2, '0')}:00
              </text>
            </g>
          ))}
          <text x={36} y={26} textAnchor="end" fontSize={9} fill="var(--da-muted)">
            {fmt(maxY)}
          </text>
          <text x={36} y={180} textAnchor="end" fontSize={9} fill="var(--da-muted)">
            0
          </text>
          {/* Kayıp alanı: talebin kapasiteyi aştığı kısım */}
          {lossArea.length > 1 && (
            <polygon
              points={[...lossArea, ...capLine].join(' ')}
              fill="color-mix(in srgb, var(--da-danger) 25%, transparent)"
            />
          )}
          <polyline
            points={pts(sim.capacity)}
            fill="none"
            stroke="var(--da-success)"
            strokeWidth={2}
          />
          <polyline
            points={pts(sim.demand)}
            fill="none"
            stroke="var(--da-primary)"
            strokeWidth={2}
          />
          {queueEnabled && (
            <polyline
              points={pts(sim.queued.map((q) => q / 60))}
              fill="none"
              stroke="var(--da-warning)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}
          <line
            x1={X(cursor)}
            x2={X(cursor)}
            y1={20}
            y2={180}
            stroke="var(--da-fg)"
            opacity={0.4}
          />
          <g transform="translate(48, 34)">
            <rect width={10} height={3} y={-3} fill="var(--da-primary)" />
            <text x={14} y={0} fontSize={10} fill="var(--da-fg)">
              {l.demand}
            </text>
            <rect x={70} width={10} height={3} y={-3} fill="var(--da-success)" />
            <text x={84} y={0} fontSize={10} fill="var(--da-fg)">
              {l.capacity}
            </text>
            <rect
              x={150}
              width={10}
              height={8}
              y={-7}
              fill="color-mix(in srgb, var(--da-danger) 25%, transparent)"
            />
            <text x={164} y={0} fontSize={10} fill="var(--da-fg)">
              {l.dropped}
              {queueEnabled ? ' / queue' : ''}
            </text>
          </g>
        </svg>
      </figure>
      <p className="mt-2 text-xs text-muted">{l.note}</p>
    </SimShell>
  );
}
