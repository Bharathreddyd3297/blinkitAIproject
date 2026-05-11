import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, UserRound } from 'lucide-react';

import { AuthShell } from '@pages/_shared/AuthShell';
import { Button } from '@components/primitives/Button';
import { Input } from '@components/primitives/Input';
import { useAuth } from '@hooks/useAuth';
import { isApiError } from '@services/http';
import { paths } from '@routes/paths';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({ name, email, password });
      navigate(paths.home, { replace: true });
    } catch (err) {
      // Auth thunks reject with an ApiError plain object (not an Error
      // instance), so an `instanceof Error` check would always miss the
      // backend message and show a useless generic. `isApiError` handles
      // that path; we still fall through to Error / generic for safety.
      const message = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Registration failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Join Blinkit"
      subtitle="Create your account to start shopping with personalised AI recommendations."
      footer={
        <>
          Already have an account?{' '}
          <Link to={paths.login} className="text-accent-glow hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          name="name"
          label="Name"
          placeholder="Your name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          iconLeft={<UserRound size={14} />}
        />
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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
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
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
