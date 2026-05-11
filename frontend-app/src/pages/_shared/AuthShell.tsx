import { motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Container } from '@components/primitives/Container';
import { Logo } from '@components/primitives/Logo';
import { SceneCanvas } from '@three/SceneCanvas';
import { FloatingGeometry } from '@three/FloatingGeometry';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Two-column shell shared by the login and register pages.
 * Left: cinematic 3D ornament + brand. Right: form.
 *
 * On mobile we collapse to a single column and drop the 3D pane to keep the
 * form above the fold and conserve battery.
 */
export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <div className="relative">
      <Container className="grid min-h-[calc(100dvh-72px)] gap-12 py-12 md:grid-cols-2 md:py-20">
        {/* Visual */}
        <div className="relative order-2 hidden overflow-hidden rounded-3xl border border-white/10 bg-ink-900/40 md:order-1 md:block">
          <SceneCanvas preset="neon">
            <FloatingGeometry shape="sphere" position={[0, 0, 0]} scale={1.6} speed={1.0} />
            <FloatingGeometry shape="torus"  position={[1.4, 1, 0.3]} scale={0.55} color="#22e2ff" speed={1.5} />
          </SceneCanvas>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-10">
            <Link to="/" className="inline-flex"><Logo /></Link>
            <p className="mt-3 max-w-sm text-sm text-ink-300">
              Premium AI commerce. Cloud-native by design.
            </p>
          </div>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="order-1 grid place-items-center md:order-2"
        >
          <div className="glass w-full max-w-md rounded-3xl p-7 md:p-9">
            <div className="md:hidden mb-6"><Logo /></div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && <p className="mt-1.5 text-sm text-ink-300">{subtitle}</p>}

            <div className="mt-6">{children}</div>

            {footer && (
              <>
                <div className="hairline my-6" />
                <div className="text-sm text-ink-300">{footer}</div>
              </>
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
