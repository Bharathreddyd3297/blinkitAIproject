import { tokens } from '@styles/tokens';

export type LightingPreset = 'studio' | 'product' | 'ambient' | 'neon';

interface LightingProps {
  preset?: LightingPreset;
}

/**
 * Reusable lighting rigs for SceneCanvas children.
 *
 * Avoid one-off lights inside scene components — pick a preset here. If the
 * scene needs something specific, add it to this file as a new preset so the
 * lighting language stays consistent across the app.
 */
export function Lighting({ preset = 'studio' }: LightingProps) {
  switch (preset) {
    case 'product':
      return (
        <>
          <ambientLight intensity={0.35} />
          <directionalLight position={[4, 6, 5]} intensity={1.2} color="#ffffff" />
          <pointLight position={[-4, 2, -3]} intensity={1.6} color={tokens.color.neonViolet} />
          <pointLight position={[5, -3, 2]}  intensity={1.0} color={tokens.color.neonCyan} />
        </>
      );

    case 'ambient':
      return (
        <>
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 4, 4]} intensity={0.9} color="#ffffff" />
        </>
      );

    case 'neon':
      return (
        <>
          <ambientLight intensity={0.2} />
          <pointLight position={[ 4, 2, 3]} intensity={2.4} color={tokens.color.neonMagenta} />
          <pointLight position={[-4, 2, 3]} intensity={2.4} color={tokens.color.neonCyan} />
          <pointLight position={[ 0, -4, 2]} intensity={1.6} color={tokens.color.neonViolet} />
        </>
      );

    case 'studio':
    default:
      return (
        <>
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 4, 5]} intensity={0.9} color="#ffffff" />
          <pointLight position={[-3, 2, 4]}  intensity={1.4} color={tokens.color.neonViolet} />
          <pointLight position={[ 4, -2, 3]} intensity={0.9} color={tokens.color.neonCyan} />
        </>
      );
  }
}
