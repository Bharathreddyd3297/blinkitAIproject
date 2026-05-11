import { motion } from 'framer-motion';
import { Container } from '@components/primitives/Container';
import { Skeleton } from '@components/loading/Skeleton';

/**
 * Shown while a lazy route chunk downloads. We render a skeleton silhouette
 * of *some* page rather than a generic spinner — the user perceives the
 * navigation as instant because content shape appears immediately.
 */
export function RouteFallback() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="py-16"
    >
      <Container>
        <div className="mb-12 max-w-3xl space-y-4">
          <Skeleton variant="pill" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      </Container>
    </motion.div>
  );
}
