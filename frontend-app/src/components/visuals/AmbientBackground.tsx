import { Suspense, lazy } from 'react';
import { config } from '@app/config';
import { useReducedMotion } from '@hooks/useReducedMotion';

// Lazy-load the 3D backdrop so the initial bundle stays slim.
const ParticleBackdrop = lazy(() => import('./ParticleBackdrop'));

/**
 * The cinematic backdrop that sits behind every page.
 *
 * Layered in z-order:
 *   1. Aurora gradient blobs (pure CSS — cheap and always on)
 *   2. Faint grid (CSS — gives the futuristic dataspace vibe)
 *   3. Lazy-loaded 3D particle field (suspense-gated, motion-aware)
 *   4. Top + bottom mask vignettes for legibility
 *
 * Everything is `pointer-events-none` so it never intercepts UI clicks.
 */
export function AmbientBackground() {
  const reducedMotion = useReducedMotion();
  const showParticles = config.features.threeD && config.features.particles && !reducedMotion;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Aurora */}
      <div className="absolute inset-0 bg-aurora animate-aurora-shift" />

      {/* Grid */}
      <div className="absolute inset-0 bg-grid-faint [background-size:48px_48px] opacity-[0.18] mask-fade-bottom" />

      {/* 3D particles */}
      {showParticles && (
        <Suspense fallback={null}>
          <div className="absolute inset-0">
            <ParticleBackdrop />
          </div>
        </Suspense>
      )}

      {/* Vignettes */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink-950 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}
