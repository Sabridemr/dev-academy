'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Skull,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Select, SimShell } from './ui';
import { boolParam, strParam, type SimulatorProps } from './types';
import {
  ACTORS,
  OAUTH_FLOWS,
  attackExchange,
  buildSteps,
  interceptOutcome,
  type Actor,
  type OAuthFlow,
} from './oauthFlow.logic';

const L = {
  tr: {
    title: 'OAuth 2.0 akışları adım adım',
    flow: 'Akış',
    flows: {
      'authorization-code': 'Authorization code',
      'client-credentials': 'Client credentials',
      implicit: 'Implicit (önerilmez)',
    } satisfies Record<OAuthFlow, string>,
    pkce: 'PKCE (code_challenge / code_verifier)',
    pkceNa: 'PKCE yalnızca authorization code akışında anlamlıdır.',
    attack: 'Saldırı senaryosu: code ele geçirildi',
    actors: {
      browser: 'Tarayıcı',
      client: 'Uygulama',
      auth: 'Yetkilendirme sunucusu',
      resource: 'Kaynak sunucusu',
    } satisfies Record<Actor, string>,
    back: 'Geri',
    forward: 'İleri',
    play: 'Oynat',
    pause: 'Duraklat',
    restart: 'Başa dön',
    step: 'Adım',
    params: 'Gönderilen parametreler',
    none: 'Parametre yok',
    implicitWarn:
      'Implicit akış artık önerilmiyor (OAuth 2.1 ve güvenlik en iyi uygulamaları): token doğrudan tarayıcıya, URL içinde gelir ve sızabilir. Tarayıcı uygulamaları için authorization code + PKCE kullan.',
    attacker: 'Saldırgan',
    attackReq: 'POST /token (code var, code_verifier yok)',
    attackToken: 'URL’deki access_token’ı kopyalar',
    attackTitle:
      'Saldırgan kodu yakalar (ör. kötü amaçlı uygulama aynı yönlendirme şemasını kaydetmiş)',
    outcome: {
      stolen: 'Saldırı başarılı: PKCE olmadığı için çalınan kod token’a çevrildi.',
      blocked: 'Saldırı engellendi: code_verifier saldırganda yok; sunucu invalid_grant döndü.',
      'token-leaked':
        'Implicit akışta kodu çalmaya bile gerek yok: access_token doğrudan URL’de, yakalayan kullanır.',
      'not-applicable': 'Bu akışta tarayıcıdan geçen bir kod yok; saldırı senaryosu uygulanmaz.',
    },
    waiting: 'Saldırı, kod tarayıcıya yönlendirildiği adımda devreye girer.',
  },
  en: {
    title: 'OAuth 2.0 flows step by step',
    flow: 'Flow',
    flows: {
      'authorization-code': 'Authorization code',
      'client-credentials': 'Client credentials',
      implicit: 'Implicit (not recommended)',
    } satisfies Record<OAuthFlow, string>,
    pkce: 'PKCE (code_challenge / code_verifier)',
    pkceNa: 'PKCE only applies to the authorization code flow.',
    attack: 'Attack scenario: code intercepted',
    actors: {
      browser: 'Browser',
      client: 'App',
      auth: 'Authorization server',
      resource: 'Resource server',
    } satisfies Record<Actor, string>,
    back: 'Back',
    forward: 'Forward',
    play: 'Play',
    pause: 'Pause',
    restart: 'Restart',
    step: 'Step',
    params: 'Parameters sent',
    none: 'No parameters',
    implicitWarn:
      'The implicit flow is no longer recommended (OAuth 2.1 and security best practice): the token arrives in the browser inside the URL and can leak. Use authorization code + PKCE for browser apps.',
    attacker: 'Attacker',
    attackReq: 'POST /token (code, no code_verifier)',
    attackToken: 'copies the access_token from the URL',
    attackTitle:
      'Attacker captures the code (e.g. a malicious app registered the same redirect scheme)',
    outcome: {
      stolen: 'Attack succeeded: without PKCE the stolen code was redeemed for a token.',
      blocked:
        'Attack blocked: the attacker lacks the code_verifier; the server returned invalid_grant.',
      'token-leaked':
        'In the implicit flow there is no code to steal: the access_token is in the URL and whoever grabs it can use it.',
      'not-applicable': 'No code passes through a browser in this flow; the attack does not apply.',
    },
    waiting: 'The attack kicks in at the step where the code is redirected to the browser.',
  },
};

const COL_X: Record<Actor, number> = { browser: 90, client: 270, auth: 450, resource: 630 };
const ROW = 40;
const TOP = 64;

export default function OAuthFlowSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [flow, setFlow] = useState<OAuthFlow>(() =>
    strParam(params, 'flow', 'authorization-code', OAUTH_FLOWS),
  );
  const [pkce, setPkce] = useState(() => boolParam(params, 'pkce', true));
  const [attack, setAttack] = useState(false);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const steps = useMemo(() => buildSteps(flow, pkce, locale), [flow, pkce, locale]);
  const last = steps.length - 1;
  const cur = steps[Math.min(idx, last)];
  const exposeIdx = steps.findIndex((s) => s.exposes);
  const outcome = interceptOutcome(flow, pkce);
  const showAttack = attack && exposeIdx >= 0 && idx >= exposeIdx;
  const exchange = attackExchange(flow, pkce);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setIdx((i) => Math.min(last, i + 1)), 1600);
    return () => clearInterval(id);
  }, [playing, last]);
  useEffect(() => {
    if (playing && idx >= last) setPlaying(false);
  }, [playing, idx, last]);

  const go = (i: number) => {
    onInteract();
    setIdx(Math.max(0, Math.min(last, i)));
  };
  const changeFlow = (f: OAuthFlow) => {
    onInteract();
    setFlow(f);
    setIdx(0);
    setPlaying(false);
  };

  const H = TOP + steps.length * ROW + (showAttack ? ROW * 2 : 0) + 16;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            aria-label={l.back}
            title={l.back}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="btn-primary"
            aria-pressed={playing}
            onClick={() => {
              onInteract();
              if (!playing && idx >= last) setIdx(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? l.pause : l.play}
          </button>
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={() => go(idx + 1)}
            disabled={idx >= last}
            aria-label={l.forward}
            title={l.forward}
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={() => {
              setPlaying(false);
              go(0);
            }}
            aria-label={l.restart}
            title={l.restart}
          >
            <RotateCcw size={14} />
          </button>
        </>
      }
      aside={
        <>
          <Select
            label={l.flow}
            value={flow}
            options={OAUTH_FLOWS.map((f) => ({ id: f, label: l.flows[f] }))}
            onChange={changeFlow}
          />
          <label
            className={cn(
              'flex items-center justify-between gap-2 text-sm',
              flow !== 'authorization-code' && 'opacity-60',
            )}
          >
            <span>{l.pkce}</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--da-primary)]"
              checked={pkce}
              disabled={flow !== 'authorization-code'}
              onChange={(e) => {
                onInteract();
                setPkce(e.target.checked);
              }}
            />
          </label>
          {flow !== 'authorization-code' && <p className="text-xs text-muted">{l.pkceNa}</p>}
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>{l.attack}</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--da-danger)]"
              checked={attack}
              onChange={(e) => {
                onInteract();
                setAttack(e.target.checked);
              }}
            />
          </label>
          {attack && (
            <p
              className={cn(
                'flex items-start gap-2 rounded-xl border px-3 py-2 text-xs',
                outcome === 'blocked'
                  ? 'border-success/50 bg-success/10 text-success-fg'
                  : outcome === 'not-applicable'
                    ? 'border-border text-muted'
                    : 'border-danger/50 bg-danger/10 text-danger-fg',
              )}
              data-testid="oauth-outcome"
            >
              {outcome === 'blocked' ? (
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              ) : (
                <Skull size={14} className="mt-0.5 shrink-0" />
              )}
              {l.outcome[outcome]}
            </p>
          )}
          {attack && exposeIdx >= 0 && idx < exposeIdx && (
            <p className="text-xs text-muted">{l.waiting}</p>
          )}
        </>
      }
    >
      {flow === 'implicit' && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {l.implicitWarn}
        </p>
      )}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 720 ${H}`}
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-label={`${l.step} ${idx + 1}/${steps.length}: ${cur.title}`}
        >
          <defs>
            <marker
              id="oauth-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--da-muted)" />
            </marker>
          </defs>
          {ACTORS.map((a) => (
            <g key={a}>
              <rect
                x={COL_X[a] - 80}
                y={8}
                width={160}
                height={32}
                rx={10}
                fill="var(--da-surface)"
                stroke={a === cur.from || a === cur.to ? 'var(--da-primary)' : 'var(--da-border)'}
                strokeWidth={a === cur.from || a === cur.to ? 2 : 1}
              />
              <text
                x={COL_X[a]}
                y={29}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
                fill="var(--da-fg)"
              >
                {l.actors[a]}
              </text>
              <line
                x1={COL_X[a]}
                y1={40}
                x2={COL_X[a]}
                y2={H - 8}
                stroke="var(--da-border)"
                strokeDasharray="4 4"
              />
            </g>
          ))}
          {steps.map((s, i) => {
            const y = TOP + i * ROW + 14;
            const x1 = COL_X[s.from];
            const x2 = COL_X[s.to];
            const dir = x2 > x1 ? 1 : -1;
            const active = i === idx;
            const done = i < idx;
            const color = active ? 'var(--da-primary)' : 'var(--da-muted)';
            return (
              <g
                key={s.id}
                opacity={active || done ? 1 : 0.25}
                className="cursor-pointer"
                onClick={() => go(i)}
              >
                <text
                  x={(x1 + x2) / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={active ? 600 : 400}
                  fill={active ? 'var(--da-fg)' : 'var(--da-muted)'}
                  stroke="var(--da-bg)"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {i + 1}. {s.title}
                </text>
                <line
                  x1={x1 + dir * 4}
                  y1={y}
                  x2={x2 - dir * 4}
                  y2={y}
                  stroke={s.exposes && attack ? 'var(--da-danger)' : color}
                  strokeWidth={active ? 2.5 : 1.5}
                  markerEnd="url(#oauth-arrow)"
                />
                {active && !reduced && (
                  <motion.circle
                    key={`${flow}-${pkce}-${i}`}
                    cy={y}
                    r={5}
                    fill="var(--da-primary)"
                    initial={{ cx: x1 }}
                    animate={{ cx: x2 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                  />
                )}
              </g>
            );
          })}
          {showAttack && (
            <g data-testid="oauth-attack">
              {(() => {
                const y = TOP + steps.length * ROW + 14;
                const blocked = outcome === 'blocked';
                return (
                  <>
                    <text
                      x={COL_X.browser}
                      y={y + 4}
                      fontSize={12}
                      fill="var(--da-danger)"
                      fontWeight={600}
                    >
                      {l.attacker}: {exchange.request.length ? l.attackReq : l.attackToken}
                    </text>
                    {exchange.request.length > 0 && (
                      <>
                        <line
                          x1={COL_X.browser + 4}
                          y1={y + 20}
                          x2={COL_X.auth - 4}
                          y2={y + 20}
                          stroke="var(--da-danger)"
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          markerEnd="url(#oauth-arrow)"
                        />
                        <text
                          x={COL_X.auth + 10}
                          y={y + 44}
                          fontSize={12}
                          fill={blocked ? 'var(--da-success)' : 'var(--da-danger)'}
                          fontWeight={600}
                          textAnchor="middle"
                        >
                          {blocked ? '400 invalid_grant ✓' : '200 access_token ✗'}
                        </text>
                      </>
                    )}
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      <motion.div
        key={`${flow}-${pkce}-${idx}`}
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="mt-3 rounded-xl border border-border bg-surface/80 p-3"
        aria-live="polite"
      >
        <p className="text-sm font-semibold">
          {l.step} {idx + 1}/{steps.length}: {cur.title}
        </p>
        <p className="mb-2 text-xs text-muted">
          {l.actors[cur.from]} → {l.actors[cur.to]}
        </p>
        <p className="label">{l.params}</p>
        {cur.params.length === 0 ? (
          <p className="text-xs text-muted">{l.none}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            {cur.params.map(([k, v]) => (
              <div key={k} className="contents">
                <dt
                  className={cn(
                    'text-muted',
                    /code_verifier|code_challenge/.test(k) && 'text-success',
                    /^(code|access_token|#access_token)$/.test(k) && attack && 'text-danger',
                  )}
                >
                  {k}
                </dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {cur.note && <p className="mt-2 text-xs text-muted">{cur.note}</p>}
        {showAttack && <p className="mt-2 text-xs text-danger">{l.attackTitle}</p>}
        {showAttack && exchange.response && (
          <p className="mt-1 font-mono text-xs">
            <span className="text-danger">{l.attacker} →</span> {exchange.response}
          </p>
        )}
      </motion.div>
    </SimShell>
  );
}
