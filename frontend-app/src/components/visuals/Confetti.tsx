import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@hooks/useReducedMotion';

interface ConfettiProps {
  /** Total emission duration in ms. After this, the canvas fades out. */
  durationMs?: number;
  /** Number of particles to emit per burst. */
  count?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;       // gravity
  rot: number;
  vrot: number;
  size: number;
  color: string;
  shape: 'rect' | 'ribbon';
  life: number;
  maxLife: number;
}

const PALETTE = [
  '#22e2ff', // neon-cyan
  '#9b6bff', // accent
  '#ff52d9', // neon-magenta
  '#a8ff60', // neon-lime
  '#ffb347', // amber
  '#ffffff',
];

/**
 * Single-canvas confetti effect.
 *
 * Why hand-rolled? Because it lets us:
 *   - share the brand palette directly,
 *   - clean up cleanly when the overlay unmounts,
 *   - skip animation entirely under reduced-motion,
 *   - ship zero extra dependencies.
 *
 * The canvas is full-viewport and `pointer-events-none` so it never blocks
 * clicks. It self-removes after `durationMs + fadeOut`.
 */
export function Confetti({ durationMs = 2400, count = 160 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const setSize = () => {
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    };
    setSize();

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // Two bursts, mirrored from the top-left and top-right edges, give
    // the celebratory "fireworks-from-the-corners" feeling.
    const spawnBurst = (originX: number): Particle[] => {
      const arr: Particle[] = [];
      for (let i = 0; i < count / 2; i++) {
        const angle = (Math.random() * Math.PI) / 2 + (originX < W() / 2 ? 0 : Math.PI / 2);
        const speed = 5 + Math.random() * 7;
        arr.push({
          x: originX,
          y: -10,
          vx: Math.cos(angle) * speed * (originX < W() / 2 ? 1 : -1),
          vy: Math.sin(angle) * speed + 4,
          ay: 0.18,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.4,
          size: 5 + Math.random() * 8,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          shape: Math.random() > 0.6 ? 'ribbon' : 'rect',
          life: 0,
          maxLife: 90 + Math.random() * 60,
        });
      }
      return arr;
    };

    let particles: Particle[] = [
      ...spawnBurst(W() * 0.15),
      ...spawnBurst(W() * 0.85),
    ];

    let frame = 0;
    let stopped = false;
    let opacity = 1;

    const tick = () => {
      if (stopped) return;
      ctx.clearRect(0, 0, W(), H());

      particles = particles.filter((p) => {
        p.life += 1;
        p.vy += p.ay;
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.vrot;
        if (p.life > p.maxLife || p.y > H() + 40) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife) * opacity;
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.6, p.size * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      frame = requestAnimationFrame(tick);
    };

    tick();

    // Stop emitting after duration, fade canvas alpha to 0, then unmount cleanly.
    const stopTimer = setTimeout(() => {
      const fadeId = setInterval(() => {
        opacity -= 0.05;
        if (opacity <= 0) {
          clearInterval(fadeId);
          stopped = true;
          cancelAnimationFrame(frame);
        }
      }, 32);
    }, durationMs);

    window.addEventListener('resize', setSize);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(stopTimer);
      window.removeEventListener('resize', setSize);
    };
  }, [count, durationMs, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[75]"
    />
  );
}
