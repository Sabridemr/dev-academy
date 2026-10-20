'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Send, Zap, Square, RotateCcw, Power } from 'lucide-react';
import {
  LB_ALGORITHMS,
  addServer,
  completeRequest,
  createLbState,
  distributionStats,
  removeServer,
  routeRequest,
  setServerHealth,
  setServerWeight,
  type LbAlgorithm,
  type LbState,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { LogList, SimShell, Stat, Select } from './ui';
import { boolParam, numParam, strParam, type SimulatorProps } from './types';

const ALGOS = LB_ALGORITHMS.map((a) => a.id);
const CLIENT_IPS = [
  '10.0.0.4',
  '10.0.0.7',
  '172.16.3.9',
  '192.168.1.20',
  '203.0.113.5',
  '198.51.100.8',
];

interface Flight {
  id: number;
  serverIndex: number;
  rejected: boolean;
}

/**
 * Yük dengeleyici simülatörü (referans simülatör). Mantık tamamen shared/simulators/loadBalancer'da;
 * bileşen yalnızca durumu tutar, istekleri animasyonla gösterir ve istatistikleri çizer.
 */
export default function LoadBalancerSim({ params, onInteract }: SimulatorProps) {
  const { t, locale } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<LbState>(() =>
    createLbState(
      strParam(params, 'algorithm', 'round-robin', ALGOS as LbAlgorithm[]),
      numParam(params, 'servers', 3, 1, 8),
      boolParam(params, 'sticky', false),
    ),
  );
  const [flights, setFlights] = useState<Flight[]>([]);
  const [auto, setAuto] = useState(false);
  const seq = useRef(0);

  const send = useCallback(
    (count = 1) => {
      onInteract();
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const id = ++seq.current;
          const clientIp = CLIENT_IPS[Math.floor(Math.random() * CLIENT_IPS.length)];
          setState((prev) => {
            const next = routeRequest(prev, { id, clientIp, sessionId: `sess-${clientIp}` });
            const decision = next.log[next.log.length - 1];
            const serverIndex = decision.serverId
              ? next.servers.findIndex((s) => s.id === decision.serverId)
              : -1;
            setFlights((f) => [...f, { id, serverIndex, rejected: serverIndex < 0 }]);
            // İstek "işlendikten" sonra bağlantıyı kapat: sunucu gecikmesi + rastgele uzun istekler
            if (decision.serverId) {
              const server = next.servers[serverIndex];
              const duration = server.latencyMs * (Math.random() < 0.2 ? 30 : 8);
              setTimeout(() => setState((s) => completeRequest(s, decision.serverId!)), duration);
            }
            setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), reduced ? 300 : 900);
            return next;
          });
        }, i * 90);
      }
    },
    [onInteract, reduced],
  );

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => send(1), 350);
    return () => clearInterval(id);
  }, [auto, send]);

  const stats = distributionStats(state);
  const n = state.servers.length;
  const height = Math.max(260, n * 70 + 40);
  const serverY = (i: number) =>
    40 + ((height - 80) / Math.max(1, n - 1)) * i + (n === 1 ? (height - 80) / 2 : 0);

  return (
    <SimShell
      title={t('sim.distribution')}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={() => send(1)}>
            <Send size={14} /> {t('sim.send')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => send(10)}>
            <Zap size={14} /> {t('sim.burst')}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              setAuto((a) => !a);
            }}
            aria-pressed={auto}
          >
            {auto ? <Square size={14} /> : <Zap size={14} />} {auto ? t('sim.stop') : t('sim.auto')}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setAuto(false);
              setFlights([]);
              setState(createLbState(state.algorithm, n, state.stickySessions));
            }}
          >
            <RotateCcw size={14} /> {t('sim.reset')}
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={t('sim.algorithm')}
            value={state.algorithm}
            options={LB_ALGORITHMS.map((a) => ({ id: a.id, label: a.label[locale] }))}
            onChange={(v) => {
              onInteract();
              setState((s) => ({ ...s, algorithm: v }));
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.stickySessions}
              onChange={(e) =>
                setState((s) => ({ ...s, stickySessions: e.target.checked, stickyTable: {} }))
              }
            />
            {t('sim.sticky')}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => setState(addServer)}
              disabled={n >= 8}
            >
              <Plus size={14} /> {t('sim.addServer')}
            </button>
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => setState(removeServer)}
              disabled={n <= 1}
            >
              <Minus size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={t('sim.allowed')}
              value={state.totalRequests - state.rejected}
              tone="success"
            />
            <Stat
              label={t('sim.rejected')}
              value={state.rejected}
              tone={state.rejected ? 'danger' : undefined}
            />
            <Stat
              label={t('sim.imbalance')}
              value={`${stats.stdDev.toFixed(1)}%`}
              tone={stats.stdDev > 10 ? 'warning' : 'primary'}
            />
          </div>
          <div>
            <p className="label">{t('sim.log')}</p>
            <LogList
              items={state.log
                .slice(-12)
                .reverse()
                .map((l) => ({
                  key: l.requestId,
                  text: `#${l.requestId} ${l.clientIp} → ${l.reason}`,
                  tone: l.serverId ? undefined : 'danger',
                }))}
            />
          </div>
        </>
      }
    >
      <svg
        viewBox={`0 0 600 ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('sim.distribution')}
      >
        {/* İstemci ve LB */}
        <g>
          <rect
            x={10}
            y={height / 2 - 26}
            width={90}
            height={52}
            rx={10}
            fill="var(--da-surface)"
            stroke="var(--da-border)"
          />
          <text x={55} y={height / 2 + 5} textAnchor="middle" fontSize={13} fill="var(--da-fg)">
            Clients
          </text>
          <rect
            x={200}
            y={height / 2 - 34}
            width={110}
            height={68}
            rx={12}
            fill="color-mix(in srgb, var(--da-primary) 12%, var(--da-surface))"
            stroke="var(--da-primary)"
            strokeWidth={2}
          />
          <text
            x={255}
            y={height / 2 - 4}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill="var(--da-primary)"
          >
            LB
          </text>
          <text
            x={255}
            y={height / 2 + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--da-muted)"
          >
            {LB_ALGORITHMS.find((a) => a.id === state.algorithm)?.label[locale]}
          </text>
          <line
            x1={100}
            y1={height / 2}
            x2={200}
            y2={height / 2}
            stroke="var(--da-muted)"
            strokeWidth={1.5}
          />
        </g>

        {state.servers.map((s, i) => {
          const y = serverY(i);
          const share = stats.perServer[s.id] ?? 0;
          const load = Math.min(1, s.activeConnections / 10);
          return (
            <g key={s.id}>
              <line
                x1={310}
                y1={height / 2}
                x2={420}
                y2={y}
                stroke={s.healthy ? 'var(--da-border)' : 'var(--da-danger)'}
                strokeDasharray={s.healthy ? undefined : '4 4'}
                strokeWidth={1.5}
              />
              <rect
                x={420}
                y={y - 24}
                width={160}
                height={48}
                rx={10}
                fill={
                  s.healthy
                    ? 'var(--da-surface)'
                    : 'color-mix(in srgb, var(--da-danger) 15%, var(--da-surface))'
                }
                stroke={s.healthy ? 'var(--da-border)' : 'var(--da-danger)'}
                strokeWidth={1.5}
              />
              <text x={432} y={y - 5} fontSize={13} fontWeight={600} fill="var(--da-fg)">
                {s.id.toUpperCase()}
              </text>
              <text x={432} y={y + 12} fontSize={10} fill="var(--da-muted)">
                {s.served} req · {share.toFixed(0)}% · conn {s.activeConnections}
              </text>
              {/* Yük çubuğu */}
              <rect x={432} y={y + 17} width={136} height={3} rx={1.5} fill="var(--da-elevated)" />
              <motion.rect
                x={432}
                y={y + 17}
                height={3}
                rx={1.5}
                animate={{ width: 136 * load }}
                fill={load > 0.7 ? 'var(--da-danger)' : 'var(--da-success)'}
              />
              {/* Sağlık anahtarı ve ağırlık (HTML yerine SVG içi kontroller erişilebilirlik için button ile) */}
              <foreignObject x={520} y={y - 22} width={58} height={22}>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title={s.healthy ? t('sim.healthy') : t('sim.down')}
                    aria-label={`${s.id} ${s.healthy ? t('sim.healthy') : t('sim.down')}`}
                    aria-pressed={!s.healthy}
                    onClick={() => {
                      onInteract();
                      setState((st) => setServerHealth(st, s.id, !s.healthy));
                    }}
                    className={s.healthy ? 'text-success' : 'text-danger'}
                  >
                    <Power size={14} />
                  </button>
                  {state.algorithm.startsWith('weighted') ||
                  state.algorithm === 'least-connections' ? (
                    <button
                      type="button"
                      className="rounded bg-elevated px-1 text-xs"
                      title={t('sim.weight')}
                      aria-label={`${s.id} ${t('sim.weight')} ${s.weight}`}
                      onClick={() =>
                        setState((st) => setServerWeight(st, s.id, (s.weight % 5) + 1))
                      }
                    >
                      w{s.weight}
                    </button>
                  ) : null}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Uçan istekler */}
        <AnimatePresence>
          {flights.map((f) => {
            const targetY = f.serverIndex >= 0 ? serverY(f.serverIndex) : height / 2;
            const targetX = f.serverIndex >= 0 ? 420 : 255;
            return (
              <motion.circle
                key={f.id}
                r={6}
                fill={f.rejected ? 'var(--da-danger)' : 'var(--da-accent)'}
                initial={{ cx: 100, cy: height / 2, opacity: 1 }}
                animate={
                  reduced
                    ? { cx: targetX, cy: targetY }
                    : { cx: [100, 255, targetX], cy: [height / 2, height / 2, targetY] }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.8, ease: 'easeInOut' }}
              />
            );
          })}
        </AnimatePresence>
      </svg>
    </SimShell>
  );
}
