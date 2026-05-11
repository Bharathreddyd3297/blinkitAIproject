import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@pages/_shared/PageHeader';
import { Container } from '@components/primitives/Container';
import { GlassCard } from '@components/primitives/GlassCard';
import { Button } from '@components/primitives/Button';
import { Badge } from '@components/primitives/Badge';
import { useAuth } from '@hooks/useAuth';

export default function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div>
      <PageHeader eyebrow="Account" title="Your profile." />
      <Container>
        <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <GlassCard>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-neon-cyan text-lg font-bold text-white shadow-glow">
                {user?.name?.[0]?.toUpperCase() ?? <UserRound size={20} />}
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {user?.name ?? 'Member'}
                </h2>
                <p className="text-sm text-ink-300">{user?.email}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {user?.roles.map((r) => (
                <Badge key={r} variant={r === 'ADMIN' ? 'accent' : 'neutral'}>
                  {r}
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              fullWidth
              className="mt-5"
              onClick={() => void logout()}
              iconLeft={<LogOut size={14} />}
            >
              Sign out
            </Button>
          </GlassCard>

          <GlassCard intensity="strong">
            <div className="flex items-center gap-2 text-success">
              <ShieldCheck size={14} />
              <span className="text-[0.7rem] uppercase tracking-[0.16em]">Secure session</span>
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold text-white">
              Authenticated via the gateway
            </h3>
            <p className="mt-2 text-sm text-ink-300">
              Tokens are persisted client-side. The auth-service signs and rotates
              them; the gateway validates every call before it ever touches a
              backend service.
            </p>
          </GlassCard>
        </div>
      </Container>
    </div>
  );
}
