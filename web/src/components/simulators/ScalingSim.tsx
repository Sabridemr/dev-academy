'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Minus, Plus, Square } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, SimShell, Stat } from './ui';
import { boolParam, numParam, strParam, type SimulatorProps } from './types';

/** Dikey ölçek için makine boyutları: kapasite (istek/sn) ve aylık maliyet ($) */
const SIZES = [
  { id: 'S', vcpu: 2, rps: 200, cost: 50 },
  { id: 'M', vcpu: 4, rps: 400, cost: 120 },
  { id: 'L', vcpu: 8, rps: 800, cost: 300 },
  { id: 'XL', vcpu: 16, rps: 1500, cost: 800 },
  { id: '2XL', vcpu: 32, rps: 2600, cost: 2100 },
];
const REPLICA_COST = 60;
const LB_COST = 20;
const BASE_LATENCY = 20;

const L = {
  tr: {
    title: 'Dikey vs yatay ölçekleme',
    traffic: 'Trafik (istek/sn)',
    vertical: 'Dikey (scale up)',
    horizontal: 'Yatay (scale out)',
    size: 'Makine boyutu',
    replicas: 'Replika',
    autoscale: 'Otomatik ölçekleme',
    wave: 'Trafik dalgası',
    latency: 'Gecikme',
    dropped: 'Düşen istek/sn',
    cost: 'Aylık maliyet',
    ceiling: 'Donanım tavanı! Daha büyük makine yok.',
    zoneFail: 'Bölge arızası',
    zone: 'Bölge',
    perServerCap: 'Replika kapasitesi (istek/sn)',
    spof: 'Tek sunucu = tek hata noktası (SPOF)',
    explain: 'Dikey ölçek basittir ama bir tavana ve tek hata noktasına sahiptir; maliyet doğrusal değil artar. Yatay ölçek LB gerektirir, neredeyse doğrusal büyür ve arızaya dayanıklıdır.',
  },
  en: {
    title: 'Vertical vs horizontal scaling',
    traffic: 'Traffic (req/s)',
    vertical: 'Vertical (scale up)',
    horizontal: 'Horizontal (scale out)',
    size: 'Machine size',
    replicas: 'Replicas',
    autoscale: 'Autoscaling',
    wave: 'Traffic wave',
    latency: 'Latency',
    dropped: 'Dropped req/s',
    cost: 'Monthly cost',
    ceiling: 'Hardware ceiling! No bigger machine.',
    zoneFail: 'Zone failure',
    zone: 'Zone',
    perServerCap: 'Replica capacity (req/s)',
    spof: 'Single server = single point of failure (SPOF)',
    explain: 'Vertical scaling is simple but has a ceiling and a single point of failure; cost grows super-linearly. Horizontal scaling needs an LB, grows almost linearly and tolerates failures.',
  },
};

/** Basit kuyruk modeli: kullanım arttıkça gecikme 1/(1-u) ile büyür */
function evaluate(traffic: number, capacity: number) {
  const u = capacity > 0 ? traffic / capacity : Infinity;
  const served = Math.min(traffic, capacity);
  const dropped = Math.max(0, traffic - capacity);
  const latency = capacity > 0 ? BASE_LATENCY / (1 - Math.min(u, 0.95)) : Infinity;
  return { u, served, dropped, latency };
}

export default function ScalingSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const zones = numParam(params, 'zones', 1, 1, 3);
  const maxServers = numParam(params, 'maxServers', 10, 2, 16);
  const [traffic, setTraffic] = useState(() => numParam(params, 'trafficRps', 400, 0, 5000));
  const [sizeIdx, setSizeIdx] = useState(0);
  const [replicas, setReplicas] = useState(() => numParam(params, 'servers', zones * numParam(params, 'instancesPerZone', 1, 1, 8), 1, maxServers));
  const [perCap, setPerCap] = useState(() => numParam(params, 'serverCapacityRps', 200, 50, 1000));
  const [autoscale, setAutoscale] = useState(() => boolParam(params, 'autoscale', false));
  const [wave, setWave] = useState(false);
  const [failedZone, setFailedZone] = useState<number | null>(null);
  const failureZoneParam = strParam<string>(params, 'failureZone', '');
  const mode = strParam(params, 'mode', 'both', ['both', 'vertical', 'horizontal'] as const);

  // Trafik dalgası: sinüs ile gerçekçi yük değişimi
  useEffect(() => {
    if (!wave) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      setTraffic(Math.round(900 + 700 * Math.sin(tick / 6) + Math.random() * 120));
    }, reduced ? 1000 : 500);
    return () => clearInterval(id);
  }, [wave, reduced]);

  // Otomatik ölçekleme: hedef %70 kullanım, her tikte en fazla bir replika ekler/çıkarır (gecikmeli tepki)
  useEffect(() => {
    if (!autoscale) return;
    const id = setInterval(() => {
      setReplicas((n) => {
        const desired = Math.max(1, Math.min(maxServers, Math.ceil(traffic / (perCap * 0.7))));
        return desired > n ? n + 1 : desired < n ? n - 1 : n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoscale, traffic, perCap, maxServers]);

  const size = SIZES[sizeIdx];
  const v = evaluate(traffic, size.rps);
  const servers = Array.from({ length: replicas }, (_, i) => ({ id: i, zone: i % zones }));
  const alive = servers.filter((s) => s.zone !== failedZone);
  const h = evaluate(traffic, alive.length * perCap);
  const perServerLoad = alive.length ? traffic / alive.length / perCap : 0;
  const vCost = size.cost;
  const hCost = replicas * REPLICA_COST + LB_COST;

  const interact = () => onInteract();
  const fmtMs = (ms: number) => (Number.isFinite(ms) ? `${Math.round(ms)} ms` : '∞');
  const tone = (u: number) => (u > 1 ? 'var(--da-danger)' : u > 0.75 ? 'var(--da-warning)' : 'var(--da-success)');

  // Karşılaştırma için iki panel de gösterilir; mode="horizontal" yatay paneli öne alır
  const showV = true;

  const cols = Math.min(replicas, 8);
  const rows = Math.ceil(replicas / 8);

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button type="button" className="btn-ghost" aria-pressed={wave} onClick={() => { interact(); setWave((w) => !w); }}>
          {wave ? <Square size={14} /> : <Activity size={14} />} {l.wave}
        </button>
      }
      aside={
        <>
          <Range label={l.traffic} value={traffic} min={0} max={4000} step={50} onChange={(x) => { interact(); setWave(false); setTraffic(x); }} />
          {showV && <Range label={`${l.size}: ${size.id} (${size.vcpu} vCPU)`} value={sizeIdx} min={0} max={SIZES.length - 1} format={(i) => `${SIZES[i].rps} rps`} onChange={(x) => { interact(); setSizeIdx(x); }} />}
          <div>
            <p className="label">{l.replicas}: {replicas}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" aria-label={`${l.replicas} −`} disabled={replicas <= 1 || autoscale} onClick={() => { interact(); setReplicas((n) => n - 1); }}>
                <Minus size={14} />
              </button>
              <button type="button" className="btn-ghost flex-1" aria-label={`${l.replicas} +`} disabled={replicas >= maxServers || autoscale} onClick={() => { interact(); setReplicas((n) => n + 1); }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <Range label={l.perServerCap} value={perCap} min={50} max={600} step={25} onChange={(x) => { interact(); setPerCap(x); }} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoscale} onChange={(e) => { interact(); setAutoscale(e.target.checked); }} />
            {l.autoscale}
          </label>
          {zones > 1 && (
            <div>
              <p className="label">{l.zoneFail}</p>
              <div className="flex gap-1">
                {Array.from({ length: zones }, (_, z) => {
                  const name = String.fromCharCode(97 + z);
                  return (
                    <button key={z} type="button" className={failedZone === z ? 'btn-primary px-3 py-1' : 'btn-ghost px-3 py-1'} aria-pressed={failedZone === z} onClick={() => { interact(); setFailedZone((f) => (f === z ? null : z)); }}>
                      {l.zone} {name}{failureZoneParam === name ? ' ⚠' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-muted">{l.explain}</p>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {showV && (
          <section aria-label={l.vertical} className="space-y-2">
            <h4 className="text-sm font-semibold">{l.vertical}</h4>
            <svg viewBox="0 0 280 200" className="h-auto w-full" role="img" aria-label={`${l.vertical}: ${size.id}`}>
              {/* Makine kutusu: boyutla büyür */}
              <motion.rect
                x={140}
                y={100}
                rx={10}
                fill="var(--da-surface)"
                stroke={tone(v.u)}
                strokeWidth={2.5}
                animate={{ x: 140 - (60 + sizeIdx * 25), y: 100 - (30 + sizeIdx * 14), width: (60 + sizeIdx * 25) * 2, height: (30 + sizeIdx * 14) * 2 }}
                transition={{ duration: reduced ? 0 : 0.35 }}
              />
              <text x={140} y={92} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--da-fg)">{size.id}</text>
              <text x={140} y={110} textAnchor="middle" fontSize={11} fill="var(--da-muted)">{size.vcpu} vCPU · {size.rps} rps</text>
              <rect x={90} y={120} width={100} height={8} rx={4} fill="var(--da-elevated)" />
              <motion.rect x={90} y={120} height={8} rx={4} fill={tone(v.u)} animate={{ width: 100 * Math.min(1, v.u) }} transition={{ duration: reduced ? 0 : 0.3 }} />
              <text x={140} y={144} textAnchor="middle" fontSize={11} fill="var(--da-fg)">CPU {Math.round(Math.min(v.u, 9.99) * 100)}%</text>
              <text x={140} y={194} textAnchor="middle" fontSize={10} fill="var(--da-danger)">{l.spof}</text>
            </svg>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={l.latency} value={fmtMs(v.latency)} tone={v.u > 0.8 ? 'warning' : undefined} />
              <Stat label={l.dropped} value={Math.round(v.dropped)} tone={v.dropped ? 'danger' : 'success'} />
              <Stat label={l.cost} value={`$${vCost}`} />
            </div>
            {sizeIdx === SIZES.length - 1 && v.u > 1 && <p className="text-xs font-medium text-danger" role="alert">{l.ceiling}</p>}
          </section>
        )}
        <section aria-label={l.horizontal} className={mode === 'horizontal' ? 'space-y-2 md:order-first' : 'space-y-2'}>
          <h4 className="text-sm font-semibold">{l.horizontal}</h4>
          <svg viewBox={`0 0 280 ${90 + rows * 70}`} className="h-auto w-full" role="img" aria-label={`${l.horizontal}: ${replicas}`}>
            <rect x={100} y={8} width={80} height={34} rx={8} fill="color-mix(in srgb, var(--da-primary) 12%, var(--da-surface))" stroke="var(--da-primary)" />
            <text x={140} y={30} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--da-primary)">LB</text>
            {servers.map((s, i) => {
              const col = i % 8;
              const row = Math.floor(i / 8);
              const w = 280 / cols;
              const x = col * w + w / 2;
              const y = 80 + row * 70;
              const down = s.zone === failedZone;
              const load = down ? 0 : perServerLoad;
              return (
                <motion.g key={s.id} initial={reduced ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduced ? 0 : 0.3 }}>
                  <line x1={140} y1={42} x2={x} y2={y - 8} stroke={down ? 'var(--da-danger)' : 'var(--da-border)'} strokeDasharray={down ? '3 3' : undefined} />
                  <rect x={x - Math.min(14, w / 2 - 2)} y={y - 8} width={Math.min(28, w - 4)} height={44} rx={5} fill={down ? 'color-mix(in srgb, var(--da-danger) 15%, var(--da-surface))' : 'var(--da-surface)'} stroke={down ? 'var(--da-danger)' : 'var(--da-border)'} />
                  {/* CPU çubuğu (dikey) */}
                  <rect x={x - 4} y={y - 2} width={8} height={28} rx={2} fill="var(--da-elevated)" />
                  <rect x={x - 4} y={y + 26 - 28 * Math.min(1, load)} width={8} height={28 * Math.min(1, load)} rx={2} fill={tone(load)} />
                  {zones > 1 && <text x={x} y={y + 50} textAnchor="middle" fontSize={8} fill="var(--da-muted)">{String.fromCharCode(97 + s.zone)}</text>}
                </motion.g>
              );
            })}
          </svg>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={l.latency} value={fmtMs(h.latency)} tone={h.u > 0.8 ? 'warning' : undefined} />
            <Stat label={l.dropped} value={Math.round(h.dropped)} tone={h.dropped ? 'danger' : 'success'} />
            <Stat label={l.cost} value={`$${hCost}`} />
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            {alive.length}/{replicas} · CPU {Math.round(Math.min(perServerLoad, 9.99) * 100)}% / {l.replicas.toLowerCase()}
          </p>
        </section>
      </div>
    </SimShell>
  );
}
