import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function ModuleLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
