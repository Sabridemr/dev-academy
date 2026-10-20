'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginSchema, RegisterSchema, type AuthResponse } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { safeNextPath } from '@/lib/utils';
import { OAuthButtons } from './OAuthButtons';

/** Giriş / kayıt formu: shared zod şemalarıyla istemci tarafı doğrulama, sunucu hataları alan bazında gösterilir */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSuccess = (res: AuthResponse) => {
    setSession(res.user, res.tokens);
    const next = params.get('next');
    const path = params.get('path');
    if (mode === 'register' || !res.user.selectedPathId)
      router.push(`/onboarding${path ? `?path=${encodeURIComponent(path)}` : ''}`);
    else router.push(safeNextPath(next, '/dashboard'));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const payload =
      mode === 'register' ? { ...form, locale } : { email: form.email, password: form.password };
    const schema = mode === 'register' ? RegisterSchema : LoginSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await api<AuthResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: parsed.data,
        anonymous: true,
      });
      onSuccess(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage(err.body.message ?? t('common.error'));
        if (err.body.details)
          setErrors(Object.fromEntries(err.body.details.map((d) => [d.path, d.message])));
      } else setMessage(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    name: 'email' | 'password' | 'displayName',
    type: string,
    label: string,
    autoComplete: string,
  ) => (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          type={name === 'password' && showPassword ? 'text' : type}
          autoComplete={autoComplete}
          className={name === 'password' ? 'input pr-10' : 'input'}
          value={form[name]}
          onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${name}-err` : undefined}
          required
        />
        {name === 'password' && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-fg"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {errors[name] && (
        <p id={`${name}-err`} className="mt-1 text-xs text-danger">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-center lg:py-20">
      <aside className="bg-glow relative hidden overflow-hidden rounded-3xl border border-border bg-surface p-8 lg:block">
        <div className="bg-grid absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-glow">
          <GraduationCap size={24} />
        </span>
        <h2 className="t-h2 mt-6">{t('auth.sideTitle')}</h2>
        <ul className="mt-6 space-y-3 text-sm text-muted">
          {[t('auth.benefit1'), t('auth.benefit2'), t('auth.benefit3')].map((b) => (
            <li key={b} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-fg" /> {b}
            </li>
          ))}
        </ul>
      </aside>
      <div className="card p-6 sm:p-8">
        <h1 className="t-h2 mb-6">
          {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
        </h1>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {mode === 'register' && field('displayName', 'text', t('auth.displayName'), 'name')}
          {field('email', 'email', t('auth.email'), 'email')}
          {field(
            'password',
            'password',
            t('auth.password'),
            mode === 'login' ? 'current-password' : 'new-password',
          )}
          {message && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {message}
            </p>
          )}
          <button type="submit" className="btn-primary btn-lg w-full" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting
              ? t('auth.submitting')
              : mode === 'login'
                ? t('auth.loginCta')
                : t('auth.registerCta')}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> {t('auth.or')}{' '}
          <span className="h-px flex-1 bg-border" />
        </div>
        <OAuthButtons onSuccess={onSuccess} onError={setMessage} />
        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <Link href={mode === 'login' ? '/register' : '/login'} className="text-primary underline">
            {mode === 'login' ? t('auth.registerCta') : t('auth.loginCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}
