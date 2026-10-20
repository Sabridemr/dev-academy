import { cn } from '@/lib/utils';

/** Dairesel ilerleme göstergesi (0–100). */
export function ProgressRing({
  percent,
  size = 80,
  stroke = 9,
  label,
  color = 'var(--da-primary)',
  className,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  /** Ekran okuyucu metni */
  label: string;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const r = 50 - stroke / 2;
  const ring = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={label}>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--da-elevated)"
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={ring}
          strokeDashoffset={ring * (1 - p / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
          {children}
        </div>
      )}
    </div>
  );
}
