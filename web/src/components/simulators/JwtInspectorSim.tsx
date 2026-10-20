'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Clock,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TimerOff,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Field, SimShell } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  DEFAULT_SECRET,
  SAMPLE_HEADER,
  encodeJsonPart,
  expStatus,
  forgeNoneToken,
  hasWebCrypto,
  parseJwt,
  samplePayload,
  signJwt,
  verifyJwt,
  type VerifyResult,
} from './jwtInspector.logic';

const L = {
  tr: {
    title: 'JWT inceleyici: çöz, düzenle, imzala',
    token: 'Token (header.payload.signature)',
    secret: 'Gizli anahtar (HS256)',
    header: 'Başlık (header)',
    payload: 'Gövde (payload)',
    signature: 'İmza',
    resign: 'Yeniden imzala',
    expire: 'Süresini doldur',
    none: '“alg: none” hilesini dene',
    sample: 'Yeni örnek',
    generating: 'Örnek token üretiliyor…',
    invalidJson: 'Geçersiz JSON: token güncellenmedi.',
    verify: {
      valid: 'İmza geçerli: token bu anahtarla imzalanmış ve değiştirilmemiş.',
      'invalid-signature':
        'İmza geçersiz: başlık/gövde değişti ya da anahtar farklı. Sunucu token’ı reddeder.',
      'rejected-none':
        'Reddedildi: “alg: none” imzasız token demektir. Sunucu algoritmayı token’dan değil kendi ayarından almalı.',
      'unsupported-alg':
        'Bu araç yalnızca HS256 doğrular. RS256/ES256 asimetriktir: imza özel anahtarla atılır, açık anahtarla (JWKS) doğrulanır.',
      malformed: 'Biçim hatalı: token üç base64url parçadan oluşmalı.',
      checking: 'Doğrulanıyor…',
      unavailable: 'Bu ortamda Web Crypto yok; imza doğrulanamıyor.',
    },
    exp: {
      none: 'exp alanı yok: token süresiz (önerilmez).',
      valid: 'Süresi geçerli',
      expired: 'Süresi dolmuş: imza geçerli olsa bile reddedilir.',
      'not-yet-valid': 'nbf henüz gelmedi: token şimdilik geçersiz.',
    },
    left: 'kaldı',
    ago: 'önce doldu',
    decision: 'Sunucu kararı',
    accept: 'KABUL',
    reject: 'RED',
    hsNote:
      'HS256 simetriktir: imzalayan ve doğrulayan aynı gizli anahtarı paylaşır. Gövde yalnızca base64url ile kodlanır, şifrelenmez; içine parola koyma.',
    local: 'Tüm işlemler tarayıcında yerel olarak (crypto.subtle) yapılır; hiçbir şey gönderilmez.',
  },
  en: {
    title: 'JWT inspector: decode, edit, sign',
    token: 'Token (header.payload.signature)',
    secret: 'Secret key (HS256)',
    header: 'Header',
    payload: 'Payload',
    signature: 'Signature',
    resign: 'Re-sign',
    expire: 'Make it expired',
    none: 'Try the “alg: none” trick',
    sample: 'New sample',
    generating: 'Generating a sample token…',
    invalidJson: 'Invalid JSON: token not updated.',
    verify: {
      valid: 'Signature valid: signed with this key and not modified.',
      'invalid-signature':
        'Signature invalid: header/payload changed or the key differs. The server rejects the token.',
      'rejected-none':
        'Rejected: “alg: none” means an unsigned token. The server must pin the algorithm in its own config, not read it from the token.',
      'unsupported-alg':
        'This tool only verifies HS256. RS256/ES256 are asymmetric: signed with a private key, verified with a public key (JWKS).',
      malformed: 'Malformed: a token must be three base64url parts.',
      checking: 'Verifying…',
      unavailable: 'Web Crypto is unavailable here; the signature cannot be verified.',
    },
    exp: {
      none: 'No exp claim: the token never expires (not recommended).',
      valid: 'Not expired',
      expired: 'Expired: rejected even if the signature is valid.',
      'not-yet-valid': 'nbf not reached: the token is not valid yet.',
    },
    left: 'left',
    ago: 'ago',
    decision: 'Server decision',
    accept: 'ACCEPT',
    reject: 'REJECT',
    hsNote:
      'HS256 is symmetric: signer and verifier share the same secret. The payload is only base64url-encoded, not encrypted; never put passwords in it.',
    local: 'Everything runs locally in your browser (crypto.subtle); nothing is sent anywhere.',
  },
};

const nowSec = () => Math.floor(Date.now() / 1000);

function fmtSpan(sec: number): string {
  const s = Math.abs(sec);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

export default function JwtInspectorSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initialToken = strParam(params, 'token', '').trim();
  const [secret, setSecret] = useState(() => strParam(params, 'secret', '') || DEFAULT_SECRET);
  const [token, setToken] = useState(initialToken);
  const [headerText, setHeaderText] = useState(() => parseJwt(initialToken).headerJson);
  const [payloadText, setPayloadText] = useState(() => parseJwt(initialToken).payloadJson);
  const [jsonError, setJsonError] = useState(false);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [now, setNow] = useState(nowSec);
  const hasCrypto = hasWebCrypto();

  const parsed = parseJwt(token);
  const exp = expStatus(parsed.payload, now);

  const loadToken = (t: string) => {
    const p = parseJwt(t);
    setToken(t);
    setHeaderText(p.headerJson);
    setPayloadText(p.payloadJson);
    setJsonError(false);
  };

  const makeSample = async (key: string) => {
    const payload = samplePayload(nowSec());
    if (!hasWebCrypto()) {
      loadToken(
        `${encodeJsonPart(JSON.stringify(SAMPLE_HEADER))}.${encodeJsonPart(JSON.stringify(payload))}.`,
      );
      return;
    }
    loadToken(await signJwt({ ...SAMPLE_HEADER }, payload, key));
  };

  // Token verilmediyse örnek üret
  useEffect(() => {
    if (!initialToken) void makeSample(secret);
    // yalnızca ilk kurulumda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(nowSec()), 1000);
    return () => clearInterval(id);
  }, []);

  // Token ya da anahtar değişince imzayı doğrula
  useEffect(() => {
    if (!token || !hasCrypto) {
      setVerify(null);
      return;
    }
    let alive = true;
    setVerify(null);
    verifyJwt(token, secret)
      .then((r) => alive && setVerify(r))
      .catch((e: unknown) => alive && setVerify({ status: 'malformed', error: String(e) }));
    return () => {
      alive = false;
    };
  }, [token, secret, hasCrypto]);

  /** Başlık/gövde düzenlenince imzayı koruyarak token'ı yeniden kur: imza artık eşleşmez */
  const editPart = (which: 'header' | 'payload', text: string) => {
    onInteract();
    if (which === 'header') setHeaderText(text);
    else setPayloadText(text);
    const h = encodeJsonPart(which === 'header' ? text : headerText);
    const p = encodeJsonPart(which === 'payload' ? text : payloadText);
    if (h === null || p === null) {
      setJsonError(true);
      return;
    }
    setJsonError(false);
    setToken(`${h}.${p}.${parsed.parts[2]}`);
  };

  const resign = async () => {
    onInteract();
    if (!hasCrypto) return;
    try {
      const header = { ...(JSON.parse(headerText) as Record<string, unknown>), alg: 'HS256' };
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      loadToken(await signJwt(header, payload, secret));
    } catch {
      setJsonError(true);
    }
  };

  const expire = () => {
    if (!parsed.payload) return;
    const payload = { ...parsed.payload, exp: nowSec() - 60 };
    editPart('payload', JSON.stringify(payload, null, 2));
  };

  const accepted = verify?.status === 'valid' && exp !== 'expired' && exp !== 'not-yet-valid';
  const tone = (s: VerifyResult['status']) =>
    s === 'valid'
      ? 'border-success/50 bg-success/10 text-success-fg'
      : s === 'unsupported-alg'
        ? 'border-warning/50 bg-warning/10 text-warning-fg'
        : 'border-danger/50 bg-danger/10 text-danger-fg';
  const expSec = typeof parsed.payload?.exp === 'number' ? (parsed.payload.exp as number) - now : 0;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <button type="button" className="btn-primary" onClick={resign} disabled={!hasCrypto}>
            <KeyRound size={14} /> {l.resign}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              onInteract();
              void makeSample(secret);
            }}
          >
            <Sparkles size={14} /> {l.sample}
          </button>
        </>
      }
      aside={
        <>
          <Field label={l.secret}>
            <input
              className="input font-mono text-xs"
              value={secret}
              spellCheck={false}
              onChange={(e) => {
                onInteract();
                setSecret(e.target.value);
              }}
            />
          </Field>
          <div className="grid gap-2">
            <button type="button" className="btn-ghost btn-sm justify-start" onClick={expire}>
              <TimerOff size={14} /> {l.expire}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm justify-start"
              onClick={() => {
                onInteract();
                loadToken(forgeNoneToken(token));
              }}
            >
              <ShieldAlert size={14} /> {l.none}
            </button>
          </div>
          <div
            className={cn(
              'rounded-xl border px-3 py-2 text-center',
              accepted ? 'border-success/50 bg-success/10' : 'border-danger/50 bg-danger/10',
            )}
            data-testid="jwt-decision"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{l.decision}</p>
            <p className={cn('text-lg font-semibold', accepted ? 'text-success' : 'text-danger')}>
              {accepted ? l.accept : l.reject}
            </p>
          </div>
          <p className="text-xs text-muted">{l.hsNote}</p>
          <p className="text-xs text-muted">{l.local}</p>
        </>
      }
    >
      <Field label={l.token}>
        <textarea
          className="input min-h-[84px] resize-y break-all font-mono text-xs"
          value={token}
          spellCheck={false}
          placeholder={l.generating}
          onChange={(e) => {
            onInteract();
            loadToken(e.target.value.trim());
          }}
        />
      </Field>

      {/* Renkli üç parça */}
      {token && (
        <p
          className="mt-2 break-all rounded-xl border border-border bg-bg/60 p-2 font-mono text-xs leading-5"
          data-testid="jwt-colored"
        >
          <span className="text-accent-fg">{parsed.parts[0]}</span>
          <span className="text-muted">.</span>
          <span className="text-primary">{parsed.parts[1]}</span>
          <span className="text-muted">.</span>
          <span className="text-success">{parsed.parts[2] || '∅'}</span>
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label={l.header}>
          <textarea
            className="input min-h-[96px] resize-y border-accent/40 font-mono text-xs"
            value={headerText}
            spellCheck={false}
            onChange={(e) => editPart('header', e.target.value)}
          />
        </Field>
        <Field label={l.payload}>
          <textarea
            className="input min-h-[96px] resize-y border-primary/40 font-mono text-xs"
            value={payloadText}
            spellCheck={false}
            onChange={(e) => editPart('payload', e.target.value)}
          />
        </Field>
      </div>
      {jsonError && <p className="mt-1 text-xs text-danger">{l.invalidJson}</p>}

      <div className="mt-3 grid gap-2" aria-live="polite">
        <motion.p
          key={verify?.status ?? 'pending'}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          data-testid="jwt-verify"
          className={cn(
            'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
            verify ? tone(verify.status) : 'border-border text-muted',
          )}
        >
          {!hasCrypto ? (
            <>
              <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {l.verify.unavailable}
            </>
          ) : !verify ? (
            <>
              <RefreshCw size={16} className="mt-0.5 shrink-0" />{' '}
              {token ? l.verify.checking : l.generating}
            </>
          ) : (
            <>
              {verify.status === 'valid' ? (
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              ) : verify.status === 'unsupported-alg' ? (
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              ) : (
                <ShieldX size={16} className="mt-0.5 shrink-0" />
              )}
              <span>
                {l.verify[verify.status]}
                {verify.status === 'invalid-signature' && (
                  <span className="mt-1 block break-all font-mono text-xs opacity-80">
                    {l.signature}: {verify.expected}
                  </span>
                )}
              </span>
            </>
          )}
        </motion.p>
        {parsed.payload && (
          <p
            data-testid="jwt-exp"
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
              exp === 'valid'
                ? 'border-success/50 text-success-fg'
                : exp === 'none'
                  ? 'border-warning/50 text-warning-fg'
                  : 'border-danger/50 text-danger-fg',
            )}
          >
            {exp === 'valid' ? <BadgeCheck size={16} /> : <Clock size={16} />}
            {l.exp[exp]}
            {exp === 'valid' && ` · ${fmtSpan(expSec)} ${l.left}`}
            {exp === 'expired' && ` · ${fmtSpan(expSec)} ${l.ago}`}
          </p>
        )}
      </div>
    </SimShell>
  );
}
