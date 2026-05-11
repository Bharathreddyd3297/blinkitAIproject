import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CloudCog,
  Cpu,
  Layers,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { config } from '@app/config';
import { paths } from '@routes/paths';
import { recommendationService } from '@services/recommendationService';
import type { Recommendation } from '@app-types/domain';

import { Container } from '@components/primitives/Container';
import { Button } from '@components/primitives/Button';
import { Badge } from '@components/primitives/Badge';
import { GlassCard } from '@components/primitives/GlassCard';
import { CategoryShowcase } from '@components/product/CategoryShowcase';
import { RecommendationCarousel } from '@components/product/RecommendationCarousel';
import { Reveal } from '@animations/Reveal';
import { Stagger, StaggerItem } from '@animations/Stagger';
import { heroTextContainer, heroTextLine } from '@animations/variants';
import { SceneCanvas } from '@three/SceneCanvas';
import { FloatingGeometry } from '@three/FloatingGeometry';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI recommendations',
    body: 'Vector-search powered by the recommendation service. Personalised in milliseconds.',
  },
  {
    icon: CloudCog,
    title: 'Cloud-native',
    body: 'Distributed microservices on AKS, scaled by traffic â€” never overprovisioned.',
  },
  {
    icon: Zap,
    title: 'Sub-100ms reads',
    body: 'Redis caching across hot paths keeps catalog and cart instant under load.',
  },
  {
    icon: ShieldCheck,
    title: 'Gateway-secured',
    body: 'Frontend talks only to the API gateway. JWT, rate limits, audit logs at the edge.',
  },
  {
    icon: Layers,
    title: 'Composable services',
    body: 'auth Â· products Â· cart Â· orders Â· payments Â· ai â€” independently deployable.',
  },
  {
    icon: Cpu,
    title: 'Observability built-in',
    body: 'Correlation IDs flow from this UI through every span the platform emits.',
  },
];

const STATS = [
  { k: '99.95%', v: 'Gateway uptime' },
  { k: '<80ms',  v: 'p50 catalog read' },
  { k: '7+',     v: 'Microservices' },
  { k: 'âˆž',      v: 'Scale on AKS' },
];

export default function HomePage() {
  const [trending, setTrending]       = useState<Recommendation[]>([]);
  const [forYou, setForYou]           = useState<Recommendation[]>([]);
  const [trendingLoading, setTL]      = useState(true);
  const [forYouLoading, setFL]        = useState(true);

  useEffect(() => {
    let cancelled = false;
    recommendationService.trending(10)
      .then((r) => { if (!cancelled) setTrending(r); })
      .finally(() => { if (!cancelled) setTL(false); });
    recommendationService.forUser(8)
      .then((r) => { if (!cancelled) setForYou(r); })
      .finally(() => { if (!cancelled) setFL(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      {/* =====================================================================
       * Hero
       * ===================================================================*/}
      <section className="relative pt-12 md:pt-20">
        {/* 3D ornament â€” sits behind the hero copy */}
        <div className="pointer-events-none absolute inset-0 -z-0">
          <SceneCanvas preset="neon" className="!h-[640px]">
            <FloatingGeometry
              shape="icosa"
              position={[2.4, 0.6, 0]}
              scale={1.5}
              speed={1.2}
              floatIntensity={1.6}
            />
            <FloatingGeometry
              shape="torus"
              position={[-2.6, -0.4, -1]}
              scale={0.9}
              color="#22e2ff"
              speed={1.6}
              rotationIntensity={1.3}
            />
          </SceneCanvas>
        </div>

        <Container className="relative">
          <motion.div
            variants={heroTextContainer}
            initial="initial"
            animate="enter"
            className="max-w-3xl"
          >
            <motion.div variants={heroTextLine}>
              <Badge variant="accent">
                <Sparkles size={12} /> AI-powered instant commerce
              </Badge>
            </motion.div>

            <motion.h1
              variants={heroTextLine}
              className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
            >
              <span className="text-gradient">Instant commerce, </span>
              <br />
              curated in real time by
              <br />
              <span className="text-gradient">your own AI.</span>
            </motion.h1>

            <motion.p
              variants={heroTextLine}
              className="mt-6 max-w-xl text-balance text-base text-ink-200 md:text-lg"
            >
              {config.app.name} is a premium AI-powered storefront on a distributed
              microservices platform. Recommendations, payments, orders â€” all behind
              one elegant gateway.
            </motion.p>

            <motion.div
              variants={heroTextLine}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link to={paths.products}>
                <Button size="lg" iconRight={<ArrowRight size={16} />}>
                  Explore catalog
                </Button>
              </Link>
              <Link to={paths.recommendations}>
                <Button size="lg" variant="outline" iconLeft={<Sparkles size={16} />}>
                  AI picks for you
                </Button>
              </Link>
            </motion.div>

            <motion.div
              variants={heroTextLine}
              className="mt-12 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {STATS.map(({ k, v }) => (
                <div key={v}>
                  <div className="font-display text-2xl font-semibold text-white">{k}</div>
                  <div className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-ink-300">
                    {v}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* =====================================================================
       * Trending products (live recs from the AI service, gateway-fronted)
       * ===================================================================*/}
      <section className="pt-32">
        <Container>
          <Reveal>
            <RecommendationCarousel
              title="Trending right now"
              description="Velocity-ranked across the entire platform. Updated in real time by the AI recommendation service."
              recommendations={trending}
              loading={trendingLoading}
            />
          </Reveal>
        </Container>
      </section>

      {/* =====================================================================
       * Category showcase
       * ===================================================================*/}
      <section className="pt-24">
        <Container>
          <Reveal className="mb-8 max-w-2xl">
            <p className="eyebrow mb-3">Browse</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Every aisle, one tap away.
            </h2>
            <p className="mt-3 text-ink-300">
              Categories streamed from the product-service. Pick a lane â€” we'll
              tailor the page to that taste profile.
            </p>
          </Reveal>
          <CategoryShowcase />
        </Container>
      </section>

      {/* =====================================================================
       * AI "For you" teaser
       * ===================================================================*/}
      <section className="pt-32">
        <Container>
          <Reveal>
            <RecommendationCarousel
              title="Picked for you"
              description="Vector-similarity over your behavioural signals â€” fused with trending velocity for a single ranked feed."
              recommendations={forYou}
              loading={forYouLoading}
              emphasize
            />
          </Reveal>
        </Container>
      </section>

      {/* =====================================================================
       * Feature grid
       * ===================================================================*/}
      <section className="relative pt-32">
        <Container>
          <Reveal className="mb-12 max-w-2xl">
            <p className="eyebrow mb-3">The platform</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              A premium experience on top of a serious backend.
            </h2>
            <p className="mt-3 text-ink-300">
              The gateway is the only contract. Every service behind it scales
              independently. The frontend stays elegant, fast, and unaware of the
              chaos underneath.
            </p>
          </Reveal>

          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title}>
                <GlassCard interactive intensity="default" className="h-full">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-accent-glow shadow-glow-sm">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm text-ink-300">{body}</p>
                </GlassCard>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>

      {/* =====================================================================
       * CTA
       * ===================================================================*/}
      <section className="pt-32">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-mesh bg-[length:200%_200%] p-10 md:p-16 animate-gradient-pan">
              <div className="absolute inset-0 bg-gradient-to-br from-ink-950/60 to-transparent" />
              <div className="relative max-w-2xl">
                <h3 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
                  Ready to ship the next era of commerce?
                </h3>
                <p className="mt-3 text-ink-200">
                  Sign in, browse the AI-curated catalog, and place an order in
                  seconds. The gateway handles the rest.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={paths.register}>
                    <Button size="lg">Create account</Button>
                  </Link>
                  <Link to={paths.login}>
                    <Button size="lg" variant="ghost">Sign in</Button>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </div>
  );
}
