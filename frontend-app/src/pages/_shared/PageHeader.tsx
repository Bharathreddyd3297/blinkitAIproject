import { type ReactNode } from 'react';
import { Container } from '@components/primitives/Container';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/**
 * Consistent page-level header used across most placeholder pages.
 * Centralises the rhythm, spacing, and typography so individual pages can
 * focus on their own content layout.
 */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="pt-12 pb-10 md:pt-20 md:pb-14">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 text-pretty text-ink-300 md:text-base">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
        </div>
      </Container>
    </header>
  );
}
