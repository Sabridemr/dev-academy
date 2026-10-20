'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2Off, Loader2, MailCheck } from 'lucide-react';
import { ForgotPasswordSchema, ResetPasswordSchema, VerifyEmailSchema } from '@devacademy/shared';
import { EmptyState } from '@/components/ui/EmptyState';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { useIsAuthenticated } from '@/lib/auth-store';
import { AuthCard } from './AuthCard';

/** /forgot-password: hesap var olsun olmasın aynı "gönderildi" mesajı (hesap numaralandırmayı engeller) */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ForgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api('/auth/forgot', { method: 'POST', body: parsed.data, anonymous: true });
    } catch {
      /* Sonuç ne olursa olsun aynı yanıt gösterilir */
    } finally {
      setPending(false);
      setSent(true);
    }
  };

  if (sent)
    return (
      <AuthCard title={t('auth.forgotTitle')}>
        <div
          className="flex gap-3 rounded-xl border border-success/40 bg-success/5 p-4"
          role="status"
        >
          <MailCheck size={18} className="mt-0.5 shrink-0 text-success-fg" />
          <p className="text-sm">{t('auth.forgotSent')}</p>
        </div>
        <Link href="/login" className="btn-ghost mt-6 w-full">
          {t('auth.backToLogin')}
        </Link>
      </AuthCard>
    );

  return (
    <AuthCard title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'email-err' : undefined}
            required
          />
          {error && (
            <p id="email-err" className="mt-1 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="btn-primary btn-lg w-full" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" />}
          {pending ? t('auth.submitting') : t('auth.forgotCta')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="btn-link">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthCard>
  );
}

function InvalidLink({ retryHref, retryLabel }: { retryHref: string; retryLabel: string }) {
  const { t } = useI18n();
  return (
    <EmptyState
      compact
      icon={Link2Off}
      title={t('auth.invalidLink')}
      description={t('auth.invalidLinkHint')}
      action={
        <Link href={retryHref} className="btn-primary">
          {retryLabel}
        </Link>
      }
    />
  );
}

/** /reset-password?token=… */
export function ResetPasswordForm() {
  const { t } = useI18n();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(
    VerifyEmailSchema.safeParse({ token }).success ? 'form' : 'invalid',
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = t('auth.passwordTooShort');
    if (password !== confirm) next.confirm = t('auth.passwordMismatch');
    setErrors(next);
    if (Object.keys(next).length) return;
    const parsed = ResetPasswordSchema.safeParse({ token, newPassword: password });
    if (!parsed.success) {
      setState('invalid');
      return;
    }
    setPending(true);
    try {
      await api('/auth/reset', { method: 'POST', body: parsed.data, anonymous: true });
      setState('done');
    } catch (err) {
      if (err instanceof ApiError && [400, 401, 404, 410].includes(err.status)) {
        const pwError = err.body.details?.find((d) => d.path === 'newPassword');
        if (pwError) setErrors({ password: pwError.message });
        else setState('invalid');
      } else setMessage(t('common.error'));
    } finally {
      setPending(false);
    }
  };

  if (state === 'invalid')
    return (
      <AuthCard title={t('auth.resetTitle')}>
        <InvalidLink retryHref="/forgot-password" retryLabel={t('auth.requestNewLink')} />
      </AuthCard>
    );
  if (state === 'done')
    return (
      <AuthCard title={t('auth.resetTitle')}>
        <EmptyState
          compact
          icon={CheckCircle2}
          title={t('auth.resetDone')}
          description={t('auth.resetDoneHint')}
          action={
            <Link href="/login" className="btn-primary">
              {t('auth.loginCta')}
            </Link>
          }
        />
      </AuthCard>
    );

  const field = (
    id: 'password' | 'confirm',
    label: string,
    value: string,
    set: (v: string) => void,
  ) => (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        minLength={8}
        className="input"
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-err` : undefined}
        required
      />
      {errors[id] && (
        <p id={`${id}-err`} className="mt-1 text-xs text-danger">
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <AuthCard title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {field('password', t('auth.newPassword'), password, setPassword)}
        {field('confirm', t('auth.confirmPassword'), confirm, setConfirm)}
        {message && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {message}
          </p>
        )}
        <button type="submit" className="btn-primary btn-lg w-full" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" />}
          {pending ? t('auth.submitting') : t('auth.resetCta')}
        </button>
      </form>
    </AuthCard>
  );
}

/** /verify-email?token=… : açılışta bir kez doğrular */
export function VerifyEmailView() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const authed = useIsAuthenticated();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'pending' | 'done' | 'invalid'>(() =>
    VerifyEmailSchema.safeParse({ token }).success ? 'pending' : 'invalid',
  );
  const started = useRef(false);

  useEffect(() => {
    if (state !== 'pending' || started.current) return;
    started.current = true; // StrictMode çift efektinde token iki kez harcanmasın
    void api('/auth/verify-email', { method: 'POST', body: { token }, anonymous: true })
      .then(() => {
        setState('done');
        void qc.invalidateQueries({ queryKey: ['me'] });
      })
      .catch(() => setState('invalid'));
  }, [state, token, qc]);

  return (
    <AuthCard title={t('auth.verifyTitle')}>
      {state === 'pending' && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 size={16} className="animate-spin" /> {t('auth.verifying')}
        </p>
      )}
      {state === 'done' && (
        <EmptyState
          compact
          icon={CheckCircle2}
          title={t('auth.verified')}
          description={t('auth.verifiedHint')}
          action={
            <Link href={authed ? '/dashboard' : '/login'} className="btn-primary">
              {authed ? t('auth.goDashboard') : t('auth.loginCta')}
            </Link>
          }
        />
      )}
      {state === 'invalid' && (
        <EmptyState
          compact
          icon={Link2Off}
          title={t('auth.invalidLink')}
          description={t('auth.verifyFailedHint')}
          action={
            <Link href={authed ? '/settings' : '/login'} className="btn-primary">
              {authed ? t('auth.goSettings') : t('auth.loginCta')}
            </Link>
          }
        />
      )}
    </AuthCard>
  );
}
