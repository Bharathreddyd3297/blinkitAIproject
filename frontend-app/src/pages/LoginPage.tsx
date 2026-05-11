import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';

import { AuthShell } from '@pages/_shared/AuthShell';
import { Button } from '@components/primitives/Button';
import { Input } from '@components/primitives/Input';
import { useAuth } from '@hooks/useAuth';
import { isApiError } from '@services/http';
import { paths } from '@routes/paths';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      const from = (location.state as LocationState | null)?.from ?? paths.home;
      navigate(from, { replace: true });
    } catch (err) {
      // Auth thunks reject with an ApiError plain object — not an Error
      // instance — so we read .message via isApiError first.
      const message = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your AI-curated experience."
      footer={
        <>
          New here?{' '}
          <Link to={paths.register} className="text-accent-glow hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="you@blinkit.app"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          iconLeft={<Mail size={14} />}
        />
        <Input
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          iconLeft={<Lock size={14} />}
        />
        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
