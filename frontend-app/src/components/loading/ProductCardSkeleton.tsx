import { Skeleton } from '@components/loading/Skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="card p-4">
      <Skeleton variant="thumb" className="mb-4" />
      <Skeleton variant="pill" className="mb-3" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton variant="pill" />
      </div>
    </div>
  );
}
