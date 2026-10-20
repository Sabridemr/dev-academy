'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Pause, Play, Shuffle } from 'lucide-react';
import { seededRandom } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Range, SimShell, Stat } from './ui';
import { boolParam, numParam, type SimulatorProps } from './types';

const SIZE = 400;
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

interface Driver {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const L = {
  tr: {
    title: 'Coğrafi indeks: yakındaki sürücüleri bul',
    precision: 'Geohash hassasiyeti (bit/eksen)',
    ring: 'Komşu halkası',
    radius: 'Arama yarıçapı',
    drivers: 'Sürücü sayısı',
    move: 'Sürücüleri hareket ettir',
    pause: 'Durdur',
    shuffle: 'Yeniden dağıt',
    cell: 'Yolcu hücresi',
    cellsSearched: 'Aranan hücre',
    checked: 'Kontrol edilen sürücü',
    found: 'Bulunan',
    missed: 'Kaçırılan (sınır sorunu)',
    naive: 'Naif tarama',
    speedup: 'Kazanç',
    hint: 'Haritaya tıklayarak yolcuyu taşı. Yalnızca yolcunun hücresi (+komşuları) taranır; sonra gerçek mesafeyle filtrelenir.',
    boundary:
      'Sınır sorunu: komşu halka 0 iken yarıçap içindeki ama komşu hücredeki sürücüler kaçırılır. Bu yüzden 8 komşu da aranır.',
    cellSize: 'Hücre boyu',
  },
  en: {
    title: 'Geo index: find nearby drivers',
    precision: 'Geohash precision (bits/axis)',
    ring: 'Neighbor ring',
    radius: 'Search radius',
    drivers: 'Drivers',
    move: 'Move drivers',
    pause: 'Pause',
    shuffle: 'Reshuffle',
    cell: 'Rider cell',
    cellsSearched: 'Cells searched',
    checked: 'Drivers checked',
    found: 'Found',
    missed: 'Missed (boundary problem)',
    naive: 'Naive scan',
    speedup: 'Speed-up',
    hint: 'Click the map to move the rider. Only the rider cell (+neighbors) is scanned, then filtered by true distance.',
    boundary:
      'Boundary problem: with neighbor ring 0, drivers within the radius but in an adjacent cell are missed. That is why the 8 neighbors are searched too.',
    cellSize: 'Cell size',
  },
};

function makeDrivers(n: number, seed: number): Driver[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => {
    // Şehir merkezinde yoğunlaşma: iki küme + rastgele
    const hub = i % 3;
    const cx = hub === 0 ? 130 : hub === 1 ? 270 : rnd() * SIZE;
    const cy = hub === 0 ? 150 : hub === 1 ? 260 : rnd() * SIZE;
    const spread = hub === 2 ? 0 : 70;
    return {
      id: i,
      x: Math.max(2, Math.min(SIZE - 2, cx + (rnd() - 0.5) * 2 * spread)),
      y: Math.max(2, Math.min(SIZE - 2, cy + (rnd() - 0.5) * 2 * spread)),
      vx: (rnd() - 0.5) * 3,
      vy: (rnd() - 0.5) * 3,
    };
  });
}

/** Basitleştirilmiş geohash: x ve y hücre indekslerinin bitleri iç içe geçirilip base32'ye çevrilir */
function geohash(cx: number, cy: number, bits: number): string {
  let out = '';
  for (let b = bits - 1; b >= 0; b--) out += `${(cx >> b) & 1}${(cy >> b) & 1}`;
  const padded = out.padEnd(Math.ceil(out.length / 5) * 5, '0');
  let s = '';
  for (let i = 0; i < padded.length; i += 5) s += BASE32[parseInt(padded.slice(i, i + 5), 2)];
  return s;
}

export default function GeoIndexSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [bits, setBits] = useState(() =>
    Math.max(1, Math.min(6, Math.round(numParam(params, 'resolution', 4, 1, 15) / 2))),
  );
  const [ring, setRing] = useState(() => numParam(params, 'ringSize', 1, 0, 2));
  const [radius, setRadius] = useState(40);
  const [count, setCount] = useState(() => numParam(params, 'drivers', 150, 10, 400));
  const [seed, setSeed] = useState(1);
  const [drivers, setDrivers] = useState<Driver[]>(() => makeDrivers(count, seed));
  const [rider, setRider] = useState({ x: 180, y: 190 });
  const [moving, setMoving] = useState(false);
  const showBoundary = boolParam(params, 'showBoundaryProblem', true);

  useEffect(() => setDrivers(makeDrivers(count, seed)), [count, seed]);

  // Her tikte sürücüler rastgele yürür (kenarlardan seker)
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(
      () => {
        setDrivers((ds) =>
          ds.map((d) => {
            let vx = d.vx + (Math.random() - 0.5) * 0.8;
            let vy = d.vy + (Math.random() - 0.5) * 0.8;
            vx = Math.max(-3, Math.min(3, vx));
            vy = Math.max(-3, Math.min(3, vy));
            let x = d.x + vx;
            let y = d.y + vy;
            if (x < 2 || x > SIZE - 2) {
              vx = -vx;
              x = Math.max(2, Math.min(SIZE - 2, x));
            }
            if (y < 2 || y > SIZE - 2) {
              vy = -vy;
              y = Math.max(2, Math.min(SIZE - 2, y));
            }
            return { ...d, x, y, vx, vy };
          }),
        );
      },
      reduced ? 600 : 120,
    );
    return () => clearInterval(id);
  }, [moving, reduced]);

  const cellsPerSide = 1 << bits;
  const cell = SIZE / cellsPerSide;
  const rcx = Math.min(cellsPerSide - 1, Math.floor(rider.x / cell));
  const rcy = Math.min(cellsPerSide - 1, Math.floor(rider.y / cell));

  const result = useMemo(() => {
    // Hücre → sürücü listesi (gerçek sistemde Redis GEO / hash tablosu)
    const buckets = new Map<string, Driver[]>();
    for (const d of drivers) {
      const k = `${Math.min(cellsPerSide - 1, Math.floor(d.x / cell))},${Math.min(cellsPerSide - 1, Math.floor(d.y / cell))}`;
      const arr = buckets.get(k);
      if (arr) arr.push(d);
      else buckets.set(k, [d]);
    }
    const searched: [number, number][] = [];
    for (let dx = -ring; dx <= ring; dx++)
      for (let dy = -ring; dy <= ring; dy++) {
        const x = rcx + dx;
        const y = rcy + dy;
        if (x >= 0 && y >= 0 && x < cellsPerSide && y < cellsPerSide) searched.push([x, y]);
      }
    const candidates = searched.flatMap(([x, y]) => buckets.get(`${x},${y}`) ?? []);
    const candidateIds = new Set(candidates.map((c) => c.id));
    const within = (d: Driver) => Math.hypot(d.x - rider.x, d.y - rider.y) <= radius;
    const found = candidates.filter(within);
    const missed = drivers.filter((d) => within(d) && !candidateIds.has(d.id));
    return {
      searched,
      candidateIds,
      found: new Set(found.map((f) => f.id)),
      missed: new Set(missed.map((m) => m.id)),
      checked: candidates.length,
    };
  }, [drivers, cellsPerSide, cell, ring, rcx, rcy, rider, radius]);

  const moveRider = (e: MouseEvent<SVGSVGElement>) => {
    onInteract();
    const r = e.currentTarget.getBoundingClientRect();
    setRider({
      x: ((e.clientX - r.left) / r.width) * SIZE,
      y: ((e.clientY - r.top) / r.height) * SIZE,
    });
  };

  const speedup = result.checked > 0 ? drivers.length / result.checked : drivers.length;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-primary"
            aria-pressed={moving}
            onClick={() => {
              onInteract();
              setMoving((m) => !m);
            }}
          >
            {moving ? <Pause size={14} /> : <Play size={14} />} {moving ? l.pause : l.move}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              setSeed((s) => s + 1);
            }}
          >
            <Shuffle size={14} /> {l.shuffle}
          </button>
        </>
      }
      aside={
        <>
          <Range
            label={l.precision}
            value={bits}
            min={1}
            max={6}
            format={(v) => `${v} → ${1 << v}×${1 << v}`}
            onChange={(v) => {
              onInteract();
              setBits(v);
            }}
          />
          <Range
            label={l.ring}
            value={ring}
            min={0}
            max={2}
            format={(v) => `${v} (${(2 * v + 1) ** 2} ${locale === 'tr' ? 'hücre' : 'cells'})`}
            onChange={(v) => {
              onInteract();
              setRing(v);
            }}
          />
          <Range
            label={l.radius}
            value={radius}
            min={10}
            max={120}
            step={5}
            onChange={(v) => {
              onInteract();
              setRadius(v);
            }}
          />
          <Range
            label={l.drivers}
            value={count}
            min={20}
            max={400}
            step={10}
            onChange={(v) => {
              onInteract();
              setCount(v);
            }}
          />
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat
              label={l.cell}
              value={<span className="font-mono">{geohash(rcx, rcy, bits)}</span>}
              tone="primary"
            />
            <Stat label={l.cellsSearched} value={result.searched.length} />
            <Stat label={l.checked} value={result.checked} tone="primary" />
            <Stat label={l.naive} value={drivers.length} />
            <Stat label={l.found} value={result.found.size} tone="success" />
            <Stat
              label={l.missed}
              value={result.missed.size}
              tone={result.missed.size ? 'danger' : undefined}
            />
            <Stat label={l.speedup} value={`${speedup.toFixed(1)}×`} tone="success" />
            <Stat label={l.cellSize} value={`${cell.toFixed(0)} u`} />
          </div>
          {showBoundary && result.missed.size > 0 && (
            <p className="text-xs text-danger" role="status">
              {l.boundary}
            </p>
          )}
        </>
      }
    >
      <p className="mb-2 text-xs text-muted">{l.hint}</p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-lg cursor-crosshair"
        role="img"
        aria-label={l.title}
        onClick={moveRider}
      >
        <rect
          width={SIZE}
          height={SIZE}
          fill="color-mix(in srgb, var(--da-success) 6%, var(--da-bg))"
        />
        {/* "Yollar" */}
        {[80, 200, 320].map((v) => (
          <g key={v} opacity={0.5}>
            <line x1={0} x2={SIZE} y1={v} y2={v + 20} stroke="var(--da-border)" strokeWidth={6} />
            <line
              y1={0}
              y2={SIZE}
              x1={v - 30}
              x2={v + 10}
              stroke="var(--da-border)"
              strokeWidth={6}
            />
          </g>
        ))}
        {/* Aranan hücreler */}
        {result.searched.map(([x, y]) => (
          <rect
            key={`${x},${y}`}
            x={x * cell}
            y={y * cell}
            width={cell}
            height={cell}
            fill={
              x === rcx && y === rcy
                ? 'color-mix(in srgb, var(--da-primary) 22%, transparent)'
                : 'color-mix(in srgb, var(--da-primary) 10%, transparent)'
            }
            stroke="var(--da-primary)"
            strokeWidth={1}
          />
        ))}
        {/* Izgara çizgileri */}
        {cellsPerSide <= 32 &&
          Array.from({ length: cellsPerSide - 1 }, (_, i) => (
            <g key={i}>
              <line
                x1={(i + 1) * cell}
                x2={(i + 1) * cell}
                y1={0}
                y2={SIZE}
                stroke="var(--da-border)"
                strokeWidth={0.6}
              />
              <line
                y1={(i + 1) * cell}
                y2={(i + 1) * cell}
                x1={0}
                x2={SIZE}
                stroke="var(--da-border)"
                strokeWidth={0.6}
              />
            </g>
          ))}
        {cellsPerSide <= 8 &&
          Array.from({ length: cellsPerSide * cellsPerSide }, (_, i) => {
            const x = i % cellsPerSide;
            const y = Math.floor(i / cellsPerSide);
            return (
              <text
                key={i}
                x={x * cell + 3}
                y={y * cell + 11}
                fontSize={9}
                fill="var(--da-muted)"
                fontFamily="monospace"
              >
                {geohash(x, y, bits)}
              </text>
            );
          })}
        <circle
          cx={rider.x}
          cy={rider.y}
          r={radius}
          fill="none"
          stroke="var(--da-accent)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        {drivers.map((d) => {
          const found = result.found.has(d.id);
          const missed = result.missed.has(d.id);
          const checked = result.candidateIds.has(d.id);
          return (
            <circle
              key={d.id}
              cx={d.x}
              cy={d.y}
              r={found || missed ? 4.5 : 3}
              fill={
                found
                  ? 'var(--da-success)'
                  : missed
                    ? 'var(--da-danger)'
                    : checked
                      ? 'var(--da-primary)'
                      : 'var(--da-muted)'
              }
              opacity={found || missed || checked ? 1 : 0.55}
              stroke={missed ? 'var(--da-surface)' : 'none'}
            />
          );
        })}
        <g transform={`translate(${rider.x}, ${rider.y})`} pointerEvents="none">
          <circle r={8} fill="var(--da-accent)" stroke="var(--da-surface)" strokeWidth={2} />
          <text y={4} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--da-surface)">
            R
          </text>
        </g>
      </svg>
      <p className="mt-1 text-xs text-muted">
        <span className="text-success">●</span> {l.found} · <span className="text-primary">●</span>{' '}
        {l.checked} · <span className="text-danger">●</span> {l.missed}
      </p>
    </SimShell>
  );
}
