'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Trash2,
  Undo2,
  User as UserIcon,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { SimShell } from './ui';
import { strParam, type SimulatorProps } from './types';
import {
  ACTIONS,
  ESCALATION_PROBE,
  RESOURCES,
  ROLES,
  USERS,
  abacEvaluator,
  allowedSet,
  defaultMatrix,
  defaultRules,
  escalatedMatrix,
  escalatedRules,
  evaluateAbac,
  evaluateRbac,
  extraGrants,
  parseCondition,
  rbacEvaluator,
  toggleMatrix,
  type Action,
  type Combining,
  type Effect,
  type RbacMatrix,
  type Rule,
  type Scenario,
} from './rbacAbac.logic';

type Mode = 'rbac' | 'abac';

const L = {
  tr: {
    title: 'Yetkilendirme politika değerlendirici',
    users: 'Kullanıcılar',
    resources: 'Kaynaklar',
    action: 'Eylem',
    policy: 'Politika',
    matrix: 'Rol → izin matrisi',
    rules: 'Kurallar (yukarıdan aşağı)',
    combining: 'Birleştirme',
    denyOverrides: 'Ret öncelikli (deny-overrides)',
    firstApplicable: 'İlk eşleşen (first-applicable)',
    allow: 'İZİN',
    deny: 'RET',
    addRule: 'Kural ekle',
    newRule: 'Yeni kural koşulu',
    remove: 'Kuralı sil',
    up: 'Yukarı taşı',
    down: 'Aşağı taşı',
    effect: 'Etki',
    escalate: 'Ayrıcalık yükseltme senaryosu',
    reset: 'Temel politikaya dön',
    evaluation: 'Değerlendirme',
    decision: 'Karar',
    extra: (n: number) => `Temel politikaya göre fazladan verilen izin: ${n}`,
    currentExtra: 'Seçili üçlü, temel politikada olmayan fazladan bir izin.',
    noExtra: 'Temel politikaya göre fazladan izin yok.',
    escalationNote: {
      rbac: 'Senaryo: “geçici” bir destek talebi için viewer rolüne silme izni verildi. Rol herkese aynı anda uygulandığı için stajyer Can da faturayı silebilir.',
      abac: 'Senaryo: kural #2’ye yazma eklenirken AND yerine OR yazıldı. Artık departman koşulu fiilen devre dışı: herkes başka departmanın raporuna yazabilir.',
    },
    level: 'seviye',
    owner: 'sahibi',
    owns: 'sahip',
    syntaxHelp:
      'Sözdizimi: user.department == resource.department AND action in [read, write] · NOT, OR, parantez, < > <= >= de kullanılabilir. Öznitelikler: user.role/department/level/owns/id, resource.id/type/owner/department/sensitivity, action.',
    rbacHint:
      'Bir hücreye tıklayarak rolün iznini aç/kapat. RBAC yalnızca rol × eyleme bakar; sahiplik ve departman umurunda değildir.',
    mode: 'Model',
    sensitivity: { public: 'herkese açık', internal: 'iç', confidential: 'gizli' },
    actions: { read: 'okuma', write: 'yazma', delete: 'silme', approve: 'onay' },
  },
  en: {
    title: 'Authorisation policy evaluator',
    users: 'Users',
    resources: 'Resources',
    action: 'Action',
    policy: 'Policy',
    matrix: 'Role → permission matrix',
    rules: 'Rules (top to bottom)',
    combining: 'Combining',
    denyOverrides: 'Deny overrides',
    firstApplicable: 'First applicable',
    allow: 'ALLOW',
    deny: 'DENY',
    addRule: 'Add rule',
    newRule: 'New rule condition',
    remove: 'Delete rule',
    up: 'Move up',
    down: 'Move down',
    effect: 'Effect',
    escalate: 'Privilege escalation scenario',
    reset: 'Back to baseline policy',
    evaluation: 'Evaluation',
    decision: 'Decision',
    extra: (n: number) => `Extra grants compared to baseline: ${n}`,
    currentExtra: 'The selected triple is an extra grant that the baseline did not allow.',
    noExtra: 'No extra grants compared to baseline.',
    escalationNote: {
      rbac: 'Scenario: for a “temporary” support ticket the viewer role was given delete. Roles apply to everyone at once, so intern Can can now delete the invoice.',
      abac: 'Scenario: while adding write to rule #2, OR was typed instead of AND. The department condition is now effectively off: anyone can write another department’s report.',
    },
    level: 'level',
    owner: 'owner',
    owns: 'owns',
    syntaxHelp:
      'Syntax: user.department == resource.department AND action in [read, write] · NOT, OR, parentheses, < > <= >= also work. Attributes: user.role/department/level/owns/id, resource.id/type/owner/department/sensitivity, action.',
    rbacHint:
      'Click a cell to toggle a role permission. RBAC only looks at role × action; ownership and department do not matter.',
    mode: 'Model',
    sensitivity: { public: 'public', internal: 'internal', confidential: 'confidential' },
    actions: { read: 'read', write: 'write', delete: 'delete', approve: 'approve' },
  },
};

const BASE_RBAC = allowedSet(rbacEvaluator(defaultMatrix()));
const BASE_ABAC = allowedSet(abacEvaluator(defaultRules(), 'deny-overrides'));

function parseError(condition: string): string | null {
  try {
    parseCondition(condition);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export default function RbacAbacSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const initialMode = strParam<Mode>(params, 'mode', 'rbac', ['rbac', 'abac']);
  const initialScenario = strParam<Scenario>(params, 'scenario', 'baseline', [
    'baseline',
    'escalation',
  ]);
  const esc = initialScenario === 'escalation';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [matrix, setMatrix] = useState<RbacMatrix>(() =>
    esc ? escalatedMatrix() : defaultMatrix(),
  );
  const [rules, setRules] = useState<Rule[]>(() => (esc ? escalatedRules() : defaultRules()));
  const [combining, setCombining] = useState<Combining>('deny-overrides');
  const probe = esc ? ESCALATION_PROBE[initialMode] : null;
  const [userId, setUserId] = useState(probe?.user ?? 'mehmet');
  const [resourceId, setResourceId] = useState(probe?.resource ?? 'doc-offer');
  const [action, setAction] = useState<Action>(probe?.action ?? 'write');
  const [scenarioOn, setScenarioOn] = useState<Mode | null>(esc ? initialMode : null);
  const [draft, setDraft] = useState('resource.owner == user.id AND action == approve');
  const [draftEffect, setDraftEffect] = useState<Effect>('allow');
  const nextId = useRef(100);

  const user = USERS.find((u) => u.id === userId)!;
  const resource = RESOURCES.find((r) => r.id === resourceId)!;
  const decision =
    mode === 'rbac'
      ? evaluateRbac(user, action, resource, matrix)
      : evaluateAbac(user, action, resource, rules, combining);

  const extras = useMemo(
    () =>
      mode === 'rbac'
        ? extraGrants(BASE_RBAC, allowedSet(rbacEvaluator(matrix)))
        : extraGrants(BASE_ABAC, allowedSet(abacEvaluator(rules, combining))),
    [mode, matrix, rules, combining],
  );

  const touch = () => onInteract();

  const applyScenario = () => {
    touch();
    const p = ESCALATION_PROBE[mode];
    if (mode === 'rbac') setMatrix(escalatedMatrix());
    else setRules(escalatedRules());
    setUserId(p.user);
    setResourceId(p.resource);
    setAction(p.action);
    setScenarioOn(mode);
  };
  const resetPolicy = () => {
    touch();
    if (mode === 'rbac') setMatrix(defaultMatrix());
    else {
      setRules(defaultRules());
      setCombining('deny-overrides');
    }
    setScenarioOn(null);
  };

  const updateRule = (id: string, patch: Partial<Rule>) => {
    touch();
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const moveRule = (idx: number, dir: -1 | 1) => {
    touch();
    setRules((rs) => {
      const j = idx + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  };
  const draftError = draft.trim() ? parseError(draft) : null;

  const actionLabel = (a: Action) => l.actions[a];
  const pill = (active: boolean) =>
    cn(
      'w-full rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      active ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-elevated',
    );

  return (
    <SimShell
      title={l.title}
      toolbar={
        <>
          <div
            className="flex rounded-xl border border-border p-0.5"
            role="group"
            aria-label={l.mode}
          >
            {(['rbac', 'abac'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                className={cn(
                  'rounded-lg px-3 py-1 text-xs font-semibold uppercase',
                  mode === m ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
                )}
                onClick={() => {
                  touch();
                  setMode(m);
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <button type="button" className="btn-danger btn-sm" onClick={applyScenario}>
            <ShieldAlert size={14} /> {l.escalate}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={resetPolicy}>
            <Undo2 size={14} /> {l.reset}
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        {/* Kullanıcılar */}
        <div>
          <p className="label">{l.users}</p>
          <div className="space-y-1.5" role="group" aria-label={l.users}>
            {USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={u.id === userId}
                className={pill(u.id === userId)}
                onClick={() => {
                  touch();
                  setUserId(u.id);
                }}
              >
                <span className="flex items-center gap-2 font-medium">
                  <UserIcon size={14} /> {u.name}
                  <span className="chip-primary chip ml-auto">{u.role}</span>
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-muted">
                  {u.department} · {l.level} {u.level}
                  {u.owns.length > 0 && ` · ${l.owns}: ${u.owns.join(', ')}`}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Kaynaklar + eylem */}
        <div>
          <p className="label">{l.resources}</p>
          <div className="space-y-1.5" role="group" aria-label={l.resources}>
            {RESOURCES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === resourceId}
                className={pill(r.id === resourceId)}
                onClick={() => {
                  touch();
                  setResourceId(r.id);
                }}
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileText size={14} /> {r.name[locale]}
                  <span
                    className={cn(
                      'chip ml-auto',
                      r.sensitivity === 'confidential' && 'border-danger/40 text-danger',
                      r.sensitivity === 'public' && 'border-success/40 text-success',
                    )}
                  >
                    {l.sensitivity[r.sensitivity]}
                  </span>
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-muted">
                  {r.id} · {r.type} · {r.department} · {l.owner}: {r.owner}
                </span>
              </button>
            ))}
          </div>
          <p className="label mt-3">{l.action}</p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={l.action}>
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={a === action}
                className={cn(pill(a === action), 'text-center')}
                onClick={() => {
                  touch();
                  setAction(a);
                }}
              >
                {actionLabel(a)} <span className="font-mono text-[11px] text-muted">{a}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Politika */}
        <div className="min-w-0">
          <p className="label">
            {l.policy}: {mode === 'rbac' ? l.matrix : l.rules}
          </p>
          {mode === 'rbac' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="rbac-matrix">
                  <thead>
                    <tr>
                      <th className="p-1 text-left text-xs text-muted" />
                      {ACTIONS.map((a) => (
                        <th key={a} className="p-1 text-xs font-medium text-muted">
                          {actionLabel(a)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((role) => (
                      <tr key={role} className={cn(role === user.role && 'bg-primary/5')}>
                        <th className="p-1 text-left font-mono text-xs">{role}</th>
                        {ACTIONS.map((a) => {
                          const on = matrix[role][a];
                          const hot = role === user.role && a === action;
                          return (
                            <td key={a} className="p-1 text-center">
                              <button
                                type="button"
                                aria-pressed={on}
                                aria-label={`${role} × ${a}`}
                                onClick={() => {
                                  touch();
                                  setMatrix((m) => toggleMatrix(m, role, a));
                                }}
                                className={cn(
                                  'h-8 w-full rounded-lg border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                  on
                                    ? 'border-success/50 bg-success/15 text-success'
                                    : 'border-border bg-surface text-muted',
                                  hot && 'ring-2 ring-primary',
                                )}
                              >
                                {on ? '✓' : '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">{l.rbacHint}</p>
            </>
          ) : (
            <>
              <label className="mb-2 flex items-center gap-2 text-xs">
                <span className="text-muted">{l.combining}</span>
                <select
                  className="input h-8 text-xs"
                  value={combining}
                  onChange={(e) => {
                    touch();
                    setCombining(e.target.value as Combining);
                  }}
                >
                  <option value="deny-overrides">{l.denyOverrides}</option>
                  <option value="first-applicable">{l.firstApplicable}</option>
                </select>
              </label>
              <ol className="space-y-1.5" data-testid="abac-rules">
                {rules.map((r, i) => {
                  const err = parseError(r.condition);
                  const hit = decision.ruleId === r.id;
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        'rounded-xl border p-2',
                        hit
                          ? decision.allowed
                            ? 'border-success bg-success/10'
                            : 'border-danger bg-danger/10'
                          : 'border-border bg-surface',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted">#{i + 1}</span>
                        <select
                          className={cn(
                            'h-7 rounded-lg border bg-surface px-1 text-xs font-semibold',
                            r.effect === 'allow'
                              ? 'border-success/50 text-success'
                              : 'border-danger/50 text-danger',
                          )}
                          aria-label={`${l.effect} #${i + 1}`}
                          value={r.effect}
                          onChange={(e) => updateRule(r.id, { effect: e.target.value as Effect })}
                        >
                          <option value="allow">{l.allow}</option>
                          <option value="deny">{l.deny}</option>
                        </select>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted">
                          {r.note?.[locale]}
                        </span>
                        <button
                          type="button"
                          className="btn-icon btn-icon-sm h-7 w-7"
                          aria-label={`${l.up} #${i + 1}`}
                          disabled={i === 0}
                          onClick={() => moveRule(i, -1)}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-sm h-7 w-7"
                          aria-label={`${l.down} #${i + 1}`}
                          disabled={i === rules.length - 1}
                          onClick={() => moveRule(i, 1)}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-sm h-7 w-7"
                          aria-label={`${l.remove} #${i + 1}`}
                          onClick={() => {
                            touch();
                            setRules((rs) => rs.filter((x) => x.id !== r.id));
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input
                        className={cn(
                          'input mt-1 h-8 font-mono text-[11px]',
                          err && 'border-danger focus:border-danger',
                        )}
                        value={r.condition}
                        spellCheck={false}
                        aria-label={`#${i + 1}`}
                        aria-invalid={!!err}
                        onChange={(e) => updateRule(r.id, { condition: e.target.value })}
                      />
                      {err && <p className="mt-0.5 text-[11px] text-danger">{err}</p>}
                    </li>
                  );
                })}
              </ol>
              <form
                className="mt-2 flex flex-wrap items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim() || draftError) return;
                  touch();
                  setRules((rs) => [
                    ...rs,
                    { id: `u${nextId.current++}`, effect: draftEffect, condition: draft.trim() },
                  ]);
                }}
              >
                <select
                  className="h-8 rounded-lg border border-border bg-surface px-1 text-xs"
                  aria-label={l.effect}
                  value={draftEffect}
                  onChange={(e) => setDraftEffect(e.target.value as Effect)}
                >
                  <option value="allow">{l.allow}</option>
                  <option value="deny">{l.deny}</option>
                </select>
                <input
                  className="input h-8 min-w-0 flex-1 font-mono text-[11px]"
                  value={draft}
                  spellCheck={false}
                  aria-label={l.newRule}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-soft btn-sm"
                  disabled={!draft.trim() || !!draftError}
                >
                  <Plus size={14} /> {l.addRule}
                </button>
                {draftError && <p className="w-full text-[11px] text-danger">{draftError}</p>}
              </form>
              <p className="mt-2 text-[11px] leading-4 text-muted">{l.syntaxHelp}</p>
            </>
          )}
        </div>
      </div>

      {/* Değerlendirme */}
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <div>
          <p className="label">
            {l.evaluation}: {user.name} · {actionLabel(action)} · {resource.name[locale]}
          </p>
          <ol
            className="space-y-1 rounded-xl border border-border bg-bg/60 p-2 text-xs"
            data-testid="rbac-steps"
            aria-live="polite"
          >
            {decision.steps.map((s, i) => (
              <motion.li
                key={`${mode}-${userId}-${resourceId}-${action}-${i}`}
                initial={reduced ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : i * 0.06 }}
                className={cn(
                  'rounded-lg px-2 py-1',
                  s.kind === 'match' && 'bg-success/10 text-success',
                  s.kind === 'skip' && 'text-muted',
                  s.kind === 'error' && 'bg-warning/10 text-warning',
                  s.kind === 'decision' &&
                    (decision.allowed
                      ? 'bg-success/15 font-semibold text-success'
                      : 'bg-danger/15 font-semibold text-danger'),
                )}
              >
                <span className="font-mono text-[11px] opacity-60">{i + 1}.</span> {s.text[locale]}
                {s.comparisons && s.comparisons.length > 0 && (
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">
                    {s.comparisons.map((c, k) => (
                      <span key={k} className="block">
                        {c.result ? '✓' : '✗'} {c.text}
                      </span>
                    ))}
                  </span>
                )}
              </motion.li>
            ))}
          </ol>
        </div>
        <div className="space-y-2">
          <div
            data-testid="rbac-decision"
            className={cn(
              'rounded-xl border px-3 py-2 text-center',
              decision.allowed
                ? 'border-success/50 bg-success/10'
                : 'border-danger/50 bg-danger/10',
            )}
          >
            <p className="text-xs uppercase tracking-wide text-muted">{l.decision}</p>
            <p
              className={cn(
                'flex items-center justify-center gap-1.5 text-lg font-semibold',
                decision.allowed ? 'text-success' : 'text-danger',
              )}
            >
              {decision.allowed ? <ShieldCheck size={18} /> : <ShieldX size={18} />}
              {decision.allowed ? l.allow : l.deny}
            </p>
          </div>
          <div
            data-testid="rbac-extra"
            className={cn(
              'rounded-xl border px-3 py-2 text-xs',
              extras.length ? 'border-warning/50 bg-warning/10' : 'border-border',
            )}
          >
            <p className={cn('font-medium', extras.length ? 'text-warning' : 'text-muted')}>
              {extras.length ? l.extra(extras.length) : l.noExtra}
            </p>
            {extras.includes(`${userId}:${action}:${resourceId}`) && (
              <p className="mt-1 font-semibold text-danger" data-testid="rbac-current-extra">
                {l.currentExtra}
              </p>
            )}
            {extras.length > 0 && (
              <ul className="mt-1 max-h-24 overflow-auto font-mono text-[11px] text-muted">
                {extras.slice(0, 12).map((k) => (
                  <li key={k}>{k.replace(/:/g, ' → ')}</li>
                ))}
                {extras.length > 12 && <li>…</li>}
              </ul>
            )}
          </div>
          {scenarioOn === mode && (
            <p className="rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs">
              {l.escalationNote[mode]}
            </p>
          )}
        </div>
      </div>
    </SimShell>
  );
}
