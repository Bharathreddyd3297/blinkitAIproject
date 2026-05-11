import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Container } from '@components/primitives/Container';
import { Button } from '@components/primitives/Button';
import { SceneCanvas } from '@three/SceneCanvas';
import { FloatingGeometry } from '@three/FloatingGeometry';
import { paths } from '@routes/paths';

export default function NotFoundPage() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
        <SceneCanvas preset="neon">
          <FloatingGeometry shape="torus" scale={1.3} speed={1.4} />
        </SceneCanvas>
      </div>
      <Container className="grid min-h-[60vh] place-items-center py-24 text-center">
        <div>
          <p className="eyebrow mb-3">404 · Lost in the cloud</p>
          <h1 className="font-display text-5xl font-semibold tracking-tight md:text-7xl">
            <span className="text-gradient">Off the gateway map.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-ink-300">
            The route you tried doesn't exist on this side of the platform.
            Let's get you back to something that does.
          </p>
          <Link to={paths.home} className="mt-6 inline-block">
            <Button iconLeft={<ArrowLeft size={14} />}>Back to home</Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}
