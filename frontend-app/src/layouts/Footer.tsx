import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter, ShieldCheck } from 'lucide-react';

import { config } from '@app/config';
import { Container } from '@components/primitives/Container';
import { Logo } from '@components/primitives/Logo';

const COLUMNS = [
  {
    label: 'Shop',
    links: [
      { to: '/products',        label: 'All products' },
      { to: '/recommendations', label: 'For you' },
      { to: '/products?sort=new', label: 'New arrivals' },
    ],
  },
  {
    label: 'Account',
    links: [
      { to: '/login',    label: 'Sign in' },
      { to: '/register', label: 'Create account' },
      { to: '/orders',   label: 'My orders' },
    ],
  },
  {
    label: 'Platform',
    links: [
      { to: '/admin', label: 'Admin' },
      { to: '#',      label: 'Status' },
      { to: '#',      label: 'API docs' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-32">
      <div className="hairline mb-12 mx-auto max-w-[1280px]" />
      <Container>
        <div className="grid gap-12 pb-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-ink-300">
              An AI-powered, cloud-native commerce experience. Built on a distributed
              microservices platform behind a single gateway boundary.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {[Github, Linkedin, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/25 hover:text-white"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.label}>
              <p className="eyebrow mb-4">{col.label}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-ink-200 transition hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="hairline" />

        <div className="flex flex-col items-start justify-between gap-4 py-6 md:flex-row md:items-center">
          <p className="text-xs text-ink-300">
            &copy; {new Date().getFullYear()} {config.app.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-xs text-ink-300">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-success" />
              TLS 1.3 · OAuth 2.1
            </span>
            <span className="text-ink-400/70">·</span>
            <span>v{config.app.version}</span>
            <span className="text-ink-400/70">·</span>
            <span className="font-mono uppercase">{config.app.env}</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
