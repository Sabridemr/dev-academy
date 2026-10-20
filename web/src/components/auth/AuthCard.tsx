import type { ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';

/** Şifre sıfırlama / doğrulama gibi tek amaçlı hesap sayfaları için ortalanmış kart */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative px-4 py-12 lg:py-20">
      <div className="bg-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="card mx-auto max-w-md p-6 sm:p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-glow">
          <GraduationCap size={22} />
        </span>
        <h1 className="t-h2 mt-5">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
