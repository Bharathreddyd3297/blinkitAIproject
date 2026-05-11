import { Canvas, type CanvasProps } from '@react-three/fiber';
import { Suspense, type ReactNode } from 'react';
import { AdaptiveDpr, AdaptiveEvents, Preload } from '@react-three/drei';

import { config } from '@app/config';
import { Lighting, type LightingPreset } from '@three/Lighting';
import { useReducedMotion } from '@hooks/useReducedMotion';

interface SceneCanvasProps extends Omit<CanvasProps, 'children'> {
  children: ReactNode;
  /** Lighting preset name. `studio` is the default — soft + neon rim. */
  preset?: LightingPreset;
  /** Enable orbit/camera interaction by default. Off in ambient backdrops. */
  interactive?: boolean;
  /** Optional className applied to the underlying <canvas>'s wrapper. */
  className?: string;
}

/**
 * Reusable React Three Fiber canvas configured for premium-but-lightweight 3D.
 *
 * This is the ONLY place we instantiate <Canvas> across the app. Centralising
 * keeps DPR caps, sRGB output, and motion preferences consistent — and gives
 * us one place to disable 3D entirely via `config.features.threeD`.
 */
export function SceneCanvas({
  children,
  preset = 'studio',
  className,
  ...rest
}: SceneCanvasProps) {
  const reducedMotion = useReducedMotion();
  if (!config.features.threeD) return null;

  return (
    <Canvas
      // Cap DPR to dodge the "Retina-on-iPad-Pro burns the GPU" failure mode.
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        // Slight stencil cost, big payoff for crisp text-on-canvas overlays.
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 100 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      className={className}
      {...rest}
    >
      <Lighting preset={preset} />
      <Suspense fallback={null}>{children}</Suspense>
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <Preload all />
    </Canvas>
  );
}
