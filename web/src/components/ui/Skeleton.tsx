import { cn } from '@/lib/utils';

/** Yükleniyor iskeletleri: içeriğin şekline yakın yer tutucular (sayfa zıplamasını azaltır). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-shimmer rounded-lg bg-[linear-gradient(90deg,rgb(var(--da-elevated-rgb))_25%,rgb(var(--da-border-rgb))_50%,rgb(var(--da-elevated-rgb))_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card space-y-3 p-5', className)} aria-hidden="true">
      <Skeleton className="h-5 w-1/3" />
      <SkeletonText lines={2} />
    </div>
  );
}

/** Ders sayfası iskeleti: başlık + metin + geniş blok */
export function SkeletonLesson() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" aria-busy="true">
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <div className="mt-8 max-w-prose space-y-3">
        <SkeletonText lines={4} />
      </div>
      <Skeleton className="mt-8 h-72 w-full rounded-2xl" />
      <div className="mt-8 max-w-prose space-y-3">
        <SkeletonText lines={5} />
      </div>
    </div>
  );
}
