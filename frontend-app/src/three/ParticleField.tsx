import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { tokens } from '@styles/tokens';

interface ParticleFieldProps {
  count?: number;
  radius?: number;
  speed?: number;
  color?: string;
  size?: number;
}

/**
 * Lightweight ambient particle cloud — soft drift, no per-frame allocations.
 *
 * The field is one BufferGeometry with one Points object. We rotate the
 * group on the GPU (via the matrix on the parent) and never touch the
 * positions array per frame, which keeps it cheap on low-end laptops.
 */
export function ParticleField({
  count = 700,
  radius = 8,
  speed = 0.04,
  color = tokens.color.accentGlow,
  size = 0.025,
}: ParticleFieldProps) {
  const groupRef = useRef<THREE.Group>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Sample uniformly inside a sphere via inverse-cube-root on the radius.
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count, radius]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * speed;
    groupRef.current.rotation.x += delta * speed * 0.4;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={positions.length / 3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={size}
          sizeAttenuation
          transparent
          opacity={0.65}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
