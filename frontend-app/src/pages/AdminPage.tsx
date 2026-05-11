import { Activity, Database, LineChart, Server, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@pages/_shared/PageHeader';
import { Container } from '@components/primitives/Container';
import { GlassCard } from '@components/primitives/GlassCard';
import { Stagger, StaggerItem } from '@animations/Stagger';

const TILES = [
  { icon: Activity, label: 'Live traffic',         value: '—', hint: 'p50/p95 latency' },
  { icon: Server,   label: 'Service health',       value: '—', hint: '/healthz aggregate' },
  { icon: Database, label: 'Cache hit rate',       value: '—', hint: 'Redis hot paths' },
  { icon: Users,    label: 'Active sessions',      value: '—', hint: 'JWT-validated' },
  { icon: LineChart,label: 'Conversion (7d)',      value: '—', hint: 'AI-attributed' },
  { icon: ShieldCheck,label: 'Auth failures (24h)',value: '—', hint: 'Throttled at gateway' },
];

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Admin · Restricted"
        title="Operational console."
        description="Operator-only view. Real-time platform telemetry, access control, and incident triage — all surfaced through gateway-fronted ops APIs."
      />
      <Container>
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map(({ icon: Icon, label, value, hint }) => (
            <StaggerItem key={label}>
              <GlassCard className="h-full">
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-accent-glow">
                    <Icon size={16} />
                  </div>
                  <span className="text-[0.7rem] uppercase tracking-[0.16em] text-ink-300">
                    {hint}
                  </span>
                </div>
                <div className="mt-5 font-display text-3xl font-semibold text-white">{value}</div>
                <div className="mt-1 text-sm text-ink-300">{label}</div>
              </GlassCard>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </div>
  );
}
