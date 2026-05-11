import { useEffect, useState } from 'react';
import { Bot, Sparkles, TrendingUp } from 'lucide-react';

import { PageHeader } from '@pages/_shared/PageHeader';
import { Container } from '@components/primitives/Container';
import { GlassCard } from '@components/primitives/GlassCard';
import { Badge } from '@components/primitives/Badge';
import { ProductGrid } from '@components/product/ProductGrid';
import { RecommendationCarousel } from '@components/product/RecommendationCarousel';
import { Reveal } from '@animations/Reveal';
import { recommendationService } from '@services/recommendationService';
import type { Recommendation } from '@app-types/domain';

const CHANNELS = [
  { key: 'forYou',   icon: Bot,        label: 'Personalised', sub: 'For your taste' },
  { key: 'trending', icon: TrendingUp, label: 'Trending',      sub: 'Across Blinkit' },
  { key: 'discover', icon: Sparkles,   label: 'Discover',      sub: 'Hidden gems'    },
] as const;

export default function RecommendationsPage() {
  const [forYou, setForYou]       = useState<Recommendation[]>([]);
  const [trending, setTrending]   = useState<Recommendation[]>([]);
  const [forYouLoading, setFL]    = useState(true);
  const [trendingLoading, setTL]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    recommendationService.forUser(12)
      .then((r) => { if (!cancelled) setForYou(r); })
      .finally(() => { if (!cancelled) setFL(false); });
    recommendationService.trending(12)
      .then((r) => { if (!cancelled) setTrending(r); })
      .finally(() => { if (!cancelled) setTL(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="AI recommendations"
        title={<>For you, <span className="text-gradient">in real time.</span></>}
        description="Vector similarity, behavioural signals, and trending velocity â€” fused by the ai-recommendation-service into a single ranked feed."
      />

      <Container>
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          {CHANNELS.map(({ icon: Icon, label, sub }) => (
            <GlassCard key={label}>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-accent/40 bg-accent/15 text-accent-glow shadow-glow-sm">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-300">{label}</p>
                  <p className="font-display text-base font-semibold text-white">{sub}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <Reveal className="mb-10">
          <RecommendationCarousel
            title="Trending right now"
            description="Velocity-ranked across the platform â€” refreshed continuously."
            recommendations={trending}
            loading={trendingLoading}
          />
        </Reveal>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">Curated for you</h2>
          <Badge variant="accent">Powered by AI</Badge>
        </div>

        <ProductGrid
          recommendations={forYou}
          loading={forYouLoading}
          skeletonCount={12}
        />
      </Container>
    </div>
  );
}
