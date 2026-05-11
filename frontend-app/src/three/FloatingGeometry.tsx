import { Float, MeshDistortMaterial } from '@react-three/drei';
import { tokens } from '@styles/tokens';

interface FloatingGeometryProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  speed?: number;
  rotationIntensity?: number;
  floatIntensity?: number;
  shape?: 'icosa' | 'torus' | 'sphere' | 'box';
}

/**
 * Reusable floating display mesh — for hero sections, empty-state visuals,
 * 404 art. The distortion shader gives it a "liquid metal" look that fits
 * the futuristic aesthetic without adding a model file.
 */
export function FloatingGeometry({
  position = [0, 0, 0],
  scale = 1,
  color = tokens.color.accent,
  speed = 1.4,
  rotationIntensity = 0.8,
  floatIntensity = 1.4,
  shape = 'icosa',
}: FloatingGeometryProps) {
  return (
    <Float
      position={position}
      speed={speed}
      rotationIntensity={rotationIntensity}
      floatIntensity={floatIntensity}
    >
      <mesh scale={scale} castShadow receiveShadow>
        {shape === 'icosa' && <icosahedronGeometry args={[1, 4]} />}
        {shape === 'torus' && <torusKnotGeometry args={[0.7, 0.22, 220, 32]} />}
        {shape === 'sphere'&& <sphereGeometry args={[1, 64, 64]} />}
        {shape === 'box'   && <boxGeometry args={[1.2, 1.2, 1.2]} />}
        <MeshDistortMaterial
          color={color}
          metalness={0.85}
          roughness={0.18}
          distort={0.32}
          speed={2.2}
          envMapIntensity={1.3}
        />
      </mesh>
    </Float>
  );
}
