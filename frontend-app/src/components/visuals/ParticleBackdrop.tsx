import { SceneCanvas } from '@three/SceneCanvas';
import { ParticleField } from '@three/ParticleField';

/**
 * Full-viewport particle backdrop. Lazy-imported by AmbientBackground so
 * users who never need 3D (reduced-motion / disabled features) don't pay
 * for the Three.js bundle.
 */
export default function ParticleBackdrop() {
  return (
    <SceneCanvas
      preset="ambient"
      // Ambient backdrop should never steal focus or pointer events.
      style={{ pointerEvents: 'none' }}
    >
      <ParticleField count={550} radius={9} speed={0.03} />
    </SceneCanvas>
  );
}
