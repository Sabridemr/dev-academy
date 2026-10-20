import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Panel/istatistik kartı: üstte küçük etiket, altta büyük değer ve isteğe bağlı alt bilgi. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  children,
  className,
  tone,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: 'primary' | 'accent' | 'success' | 'warning';
}) {
  return (
    <div className={cn('card p-5', className)}>
      <p className="t-eyebrow flex items-center gap-1.5">
        {Icon && (
          <Icon
            size={13}
            className={cn(
              tone === 'primary' && 'text-primary',
              tone === 'accent' && 'text-accent-fg',
              tone === 'success' && 'text-success-fg',
              tone === 'warning' && 'text-warning-fg',
            )}
          />
        )}
        {label}
      </p>
      {value !== undefined && (
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}
