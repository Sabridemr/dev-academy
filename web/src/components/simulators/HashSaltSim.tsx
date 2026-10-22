'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Lock, ShieldAlert, Skull, Timer } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useDebounced, usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Field, Range, Select, SimShell, Stat } from './ui';
import { boolParam, strParam, type SimulatorProps } from './types';
import {
  SLOW_COST,
  attackSeconds,
  buildDictionary,
  estimateSlowHashMs,
  formatDuration,
  hasWebCrypto,
  inDictionary,
  pbkdf2Hex,
  pbkdf2WorkFactor,
  randomSalt,
  sha256Hex,
  slowWorkFactor,
  timed,
  type SlowAlgo,
} from './hashSalt.logic';

type Algo = 'sha256' | 'pbkdf2';

const L = {
  tr: {
    title: 'Şifre hash’leme ve salt',
    password: 'Şifre (yalnızca bu tarayıcıda işlenir)',
    algo: 'Algoritma',
    iterations: 'PBKDF2 iterasyon sayısı',
    newSalts: 'Yeni salt üret',
    users: 'Aynı şifreyi kullanan iki kullanıcı',
    unsalted: 'Salt yok',
    salted: 'Kullanıcıya özel salt ile',
    salt: 'salt',
    same: 'AYNI HASH: biri kırılınca ikisi de kırılır; önceden hesaplanmış (gökkuşağı) tablolar işe yarar.',
    differ: 'Farklı hash: saldırgan her kullanıcı için ayrı ayrı denemek zorunda.',
    measured: 'Ölçülen süre (bu tarayıcıda, gerçek)',
    computing: 'Hesaplanıyor…',
    slow: 'Yavaş hash tahmini',
    slowAlgo: 'Algoritma',
    estimated: 'Tahmini süre / hash',
    estimateNote:
      'bcrypt/scrypt/argon2 tarayıcıda yerleşik değil; süre kaba bir maliyet modeliyle tahmin edilir ve donanıma göre değişir.',
    attack: 'Saldırgan paneli',
    showAttack: 'Saldırgan panelini göster',
    hideAttack: 'Saldırgan panelini gizle',
    dict: (n: number) => `${n} kelimelik sözlük (yaygın şifreler + son ekler)`,
    inDict: 'Bu şifre sözlükte var: sözlük saldırısında mutlaka bulunur.',
    notInDict: 'Bu şifre sözlükte yok: sözlük saldırısı bulamaz (kaba kuvvet gerekir).',
    leaked: 'Sızan hesap sayısı',
    speed: 'Saldırgan hızı (SHA-256 deneme/sn)',
    row: 'Senaryo',
    time: 'Tüm hesaplar için sözlüğü bitirme',
    rows: {
      plain: 'SHA-256, salt yok',
      rainbow: 'SHA-256, salt yok + hazır gökkuşağı tablosu',
      salted: 'SHA-256 + salt',
      pbkdf2: (i: number) => `PBKDF2 (${i.toLocaleString('tr')} iter.) + salt`,
      slow: (a: string) => `${a} + salt (tahmini)`,
    },
    attackNote:
      'Salt, aynı şifreleri ayırır ve hazır tabloları işe yaramaz kılar; yavaş hash her denemeyi pahalı yapar. İkisi de sözlükteki zayıf bir şifreyi kurtarmaz, yalnızca saldırganı yavaşlatır.',
    local:
      'Hiçbir şey sunucuya gönderilmez: SHA-256 ve PBKDF2 Web Crypto (crypto.subtle) ile burada hesaplanır.',
    noCrypto: 'Bu ortamda Web Crypto yok; hash hesaplanamıyor.',
    userA: 'Ali',
    userB: 'Veli',
  },
  en: {
    title: 'Password hashing and salt',
    password: 'Password (processed only in this browser)',
    algo: 'Algorithm',
    iterations: 'PBKDF2 iterations',
    newSalts: 'New salts',
    users: 'Two users with the same password',
    unsalted: 'No salt',
    salted: 'With a per-user salt',
    salt: 'salt',
    same: 'SAME HASH: crack one, crack both; precomputed (rainbow) tables work.',
    differ: 'Different hashes: the attacker must try each user separately.',
    measured: 'Measured time (in this browser, real)',
    computing: 'Computing…',
    slow: 'Slow hash estimate',
    slowAlgo: 'Algorithm',
    estimated: 'Estimated time / hash',
    estimateNote:
      'bcrypt/scrypt/argon2 are not built into browsers; the time is a rough cost-model estimate and depends on hardware.',
    attack: 'Attacker panel',
    showAttack: 'Show attacker panel',
    hideAttack: 'Hide attacker panel',
    dict: (n: number) => `${n}-word dictionary (common passwords + suffixes)`,
    inDict: 'This password is in the dictionary: a dictionary attack will find it.',
    notInDict: 'Not in the dictionary: a dictionary attack misses it (brute force needed).',
    leaked: 'Leaked accounts',
    speed: 'Attacker speed (SHA-256 guesses/s)',
    row: 'Scenario',
    time: 'Finish the dictionary for all accounts',
    rows: {
      plain: 'SHA-256, no salt',
      rainbow: 'SHA-256, no salt + ready rainbow table',
      salted: 'SHA-256 + salt',
      pbkdf2: (i: number) => `PBKDF2 (${i.toLocaleString('en')} iter.) + salt`,
      slow: (a: string) => `${a} + salt (estimated)`,
    },
    attackNote:
      'Salt separates identical passwords and defeats precomputed tables; a slow hash makes every guess expensive. Neither saves a weak dictionary password, they only slow the attacker down.',
    local:
      'Nothing is sent to a server: SHA-256 and PBKDF2 run here via Web Crypto (crypto.subtle).',
    noCrypto: 'Web Crypto is unavailable here; hashes cannot be computed.',
    userA: 'Alice',
    userB: 'Bob',
  },
};

const DICT_SIZE = buildDictionary().length;
const pow10 = (e: number) => 10 ** e;
const fmtPow = (e: number) => `10^${e}`;

interface Hashes {
  unsaltedA: string;
  unsaltedB: string;
  saltedA: string;
  saltedB: string;
  ms: number;
}

const short = (h: string) => (h.length > 32 ? `${h.slice(0, 32)}…` : h);

function HashRow({
  who,
  salt,
  hash,
  id,
  l,
}: {
  who: string;
  salt?: string;
  hash?: string;
  id: string;
  l: (typeof L)['tr'] | (typeof L)['en'];
}) {
  return (
    <div className="rounded-lg border border-border bg-bg/60 px-2 py-1.5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-medium">{who}</span>
        {salt !== undefined && (
          <span className="font-mono text-[11px] text-muted">
            {l.salt}: {salt.slice(0, 12)}…
          </span>
        )}
      </p>
      <p className="break-all font-mono text-[11px] text-primary" data-testid={id}>
        {hash ? short(hash) : l.computing}
      </p>
    </div>
  );
}

export default function HashSaltSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const [algo, setAlgo] = useState<Algo>(() =>
    strParam<Algo>(params, 'algorithm', 'sha256', ['sha256', 'pbkdf2']),
  );
  const [attackOpen, setAttackOpen] = useState(() => boolParam(params, 'showAttack', false));
  const [password, setPassword] = useState('galatasaray1');
  const [iterations, setIterations] = useState(100_000);
  const [salts, setSalts] = useState<[string, string]>(() =>
    hasWebCrypto() ? [randomSalt(), randomSalt()] : ['', ''],
  );
  const [hashes, setHashes] = useState<Hashes | null>(null);
  const [slowAlgo, setSlowAlgo] = useState<SlowAlgo>('bcrypt');
  const [slowCost, setSlowCost] = useState(SLOW_COST.bcrypt.def);
  const [usersExp, setUsersExp] = useState(4);
  const [speedExp, setSpeedExp] = useState(9);
  const hasCrypto = hasWebCrypto();

  // Nesne kimliği her çizimde değişir; geciktirme için kararlı bir metin anahtarı kullanılır
  const inputKey = useDebounced(JSON.stringify([password, algo, iterations, salts]), 250);

  useEffect(() => {
    if (!hasCrypto) return;
    let alive = true;
    setHashes(null);
    const [pw, a, it, [sa, sb]] = JSON.parse(inputKey) as [string, Algo, number, [string, string]];
    const one = (salt: string) => (a === 'sha256' ? sha256Hex(salt + pw) : pbkdf2Hex(pw, salt, it));
    (async () => {
      // Her hash ayrı hesaplanır: tuzsuz iki sonuç gerçekten karşılaştırılır
      const first = await timed(() => one(''));
      const unsaltedB = await one('');
      const [saltedA, saltedB] = await Promise.all([one(sa), one(sb)]);
      if (alive) setHashes({ unsaltedA: first.value, unsaltedB, saltedA, saltedB, ms: first.ms });
    })().catch(() => alive && setHashes(null));
    return () => {
      alive = false;
    };
  }, [inputKey, hasCrypto]);

  const touch = () => onInteract();
  const dictHit = inDictionary(password);
  const users = pow10(usersExp);
  const speed = pow10(speedExp);
  const slowLabel =
    slowAlgo === 'argon2id' ? 'Argon2id' : slowAlgo === 'scrypt' ? 'scrypt' : 'bcrypt';

  const attackRows = useMemo(() => {
    const base = { dictionary: DICT_SIZE, users, fastGuessesPerSecond: speed };
    return [
      { id: 'rainbow', label: l.rows.rainbow, sec: 0, tone: 'danger' as const },
      {
        id: 'plain',
        label: l.rows.plain,
        sec: attackSeconds({ ...base, salted: false, workFactor: 1 }),
        tone: 'danger' as const,
      },
      {
        id: 'salted',
        label: l.rows.salted,
        sec: attackSeconds({ ...base, salted: true, workFactor: 1 }),
        tone: 'warning' as const,
      },
      {
        id: 'pbkdf2',
        label: l.rows.pbkdf2(iterations),
        sec: attackSeconds({ ...base, salted: true, workFactor: pbkdf2WorkFactor(iterations) }),
        tone: 'success' as const,
      },
      {
        id: 'slow',
        label: l.rows.slow(slowLabel),
        sec: attackSeconds({
          ...base,
          salted: true,
          workFactor: slowWorkFactor(slowAlgo, slowCost),
        }),
        tone: 'success' as const,
      },
    ];
  }, [l, users, speed, iterations, slowAlgo, slowCost, slowLabel]);

  const same = hashes ? hashes.unsaltedA === hashes.unsaltedB : false;

  return (
    <SimShell
      title={l.title}
      toolbar={
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            touch();
            setSalts([randomSalt(), randomSalt()]);
          }}
          disabled={!hasCrypto}
        >
          <Dices size={14} /> {l.newSalts}
        </button>
      }
      aside={
        <>
          <div
            className="flex rounded-xl border border-border p-0.5"
            role="group"
            aria-label={l.algo}
          >
            {(['sha256', 'pbkdf2'] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={algo === a}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1 text-xs font-semibold',
                  algo === a ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
                )}
                onClick={() => {
                  touch();
                  setAlgo(a);
                }}
              >
                {a === 'sha256' ? 'SHA-256' : 'PBKDF2'}
              </button>
            ))}
          </div>
          {algo === 'pbkdf2' && (
            <Range
              label={l.iterations}
              value={iterations}
              min={1000}
              max={600_000}
              step={1000}
              onChange={(v) => {
                touch();
                setIterations(v);
              }}
              format={(v) => v.toLocaleString(locale)}
            />
          )}
          <Stat
            label={l.measured}
            value={
              <span data-testid="hs-ms">
                {hashes
                  ? `${hashes.ms < 1 ? hashes.ms.toFixed(2) : Math.round(hashes.ms)} ms`
                  : '…'}
              </span>
            }
            tone="primary"
          />
          <div className="space-y-2 rounded-xl border border-border p-2">
            <p className="label flex items-center gap-1">
              <Timer size={12} /> {l.slow}
            </p>
            <Select
              label={l.slowAlgo}
              value={slowAlgo}
              options={[
                { id: 'bcrypt', label: 'bcrypt' },
                { id: 'scrypt', label: 'scrypt' },
                { id: 'argon2id', label: 'Argon2id' },
              ]}
              onChange={(v) => {
                touch();
                setSlowAlgo(v);
                setSlowCost(SLOW_COST[v].def);
              }}
            />
            <Range
              label={SLOW_COST[slowAlgo].label}
              value={slowCost}
              min={SLOW_COST[slowAlgo].min}
              max={SLOW_COST[slowAlgo].max}
              onChange={(v) => {
                touch();
                setSlowCost(v);
              }}
            />
            <p className="text-sm">
              {l.estimated}:{' '}
              <span className="font-semibold tabular-nums" data-testid="hs-slow">
                ≈ {formatDuration(estimateSlowHashMs(slowAlgo, slowCost) / 1000, locale)}
              </span>
            </p>
            <p className="text-[11px] leading-4 text-muted">{l.estimateNote}</p>
          </div>
          <p className="text-xs text-muted">
            <Lock size={12} className="mr-1 inline" />
            {l.local}
          </p>
        </>
      }
    >
      <Field label={l.password}>
        <input
          className="input font-mono"
          value={password}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            touch();
            setPassword(e.target.value);
          }}
        />
      </Field>
      {!hasCrypto && <p className="mt-2 text-sm text-danger">{l.noCrypto}</p>}

      <p className="label mt-4">{l.users}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 rounded-xl border border-danger/40 p-2">
          <p className="text-xs font-semibold text-danger">{l.unsalted}</p>
          <HashRow l={l} who={l.userA} hash={hashes?.unsaltedA} id="hs-unsalted-a" />
          <HashRow l={l} who={l.userB} hash={hashes?.unsaltedB} id="hs-unsalted-b" />
          {hashes && same && (
            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start gap-1.5 text-xs text-danger"
              data-testid="hs-same"
            >
              <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {l.same}
            </motion.p>
          )}
        </div>
        <div className="space-y-1.5 rounded-xl border border-success/40 p-2">
          <p className="text-xs font-semibold text-success">{l.salted}</p>
          <HashRow l={l} who={l.userA} salt={salts[0]} hash={hashes?.saltedA} id="hs-salted-a" />
          <HashRow l={l} who={l.userB} salt={salts[1]} hash={hashes?.saltedB} id="hs-salted-b" />
          {hashes && hashes.saltedA !== hashes.saltedB && (
            <p className="text-xs text-success" data-testid="hs-differ">
              {l.differ}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          className="btn-ghost btn-sm"
          aria-expanded={attackOpen}
          onClick={() => {
            touch();
            setAttackOpen((o) => !o);
          }}
        >
          <Skull size={14} /> {attackOpen ? l.hideAttack : l.showAttack}
        </button>
        {attackOpen && (
          <div
            className="mt-2 rounded-xl border border-border bg-surface p-3"
            data-testid="hs-attack"
          >
            <p className="text-sm font-semibold">{l.attack}</p>
            <p className="mt-1 text-xs text-muted">{l.dict(DICT_SIZE)}</p>
            <p
              className={cn('mt-1 text-xs font-medium', dictHit ? 'text-danger' : 'text-success')}
              data-testid="hs-dict"
            >
              {dictHit ? l.inDict : l.notInDict}
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <Range
                label={l.leaked}
                value={usersExp}
                min={0}
                max={7}
                onChange={(v) => {
                  touch();
                  setUsersExp(v);
                }}
                format={(v) => pow10(v).toLocaleString(locale)}
              />
              <Range
                label={l.speed}
                value={speedExp}
                min={6}
                max={11}
                onChange={(v) => {
                  touch();
                  setSpeedExp(v);
                }}
                format={fmtPow}
              />
            </div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-medium">{l.row}</th>
                  <th className="py-1 text-right font-medium">{l.time}</th>
                </tr>
              </thead>
              <tbody>
                {attackRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-1.5 pr-2">{r.label}</td>
                    <td
                      className={cn(
                        'py-1.5 text-right font-semibold tabular-nums',
                        r.tone === 'danger' && 'text-danger',
                        r.tone === 'warning' && 'text-warning',
                        r.tone === 'success' && 'text-success',
                      )}
                      data-testid={`hs-attack-${r.id}`}
                    >
                      {formatDuration(r.sec, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">{l.attackNote}</p>
          </div>
        )}
      </div>
    </SimShell>
  );
}
