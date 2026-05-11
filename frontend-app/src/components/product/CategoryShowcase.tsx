import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { mockCategories } from '@utils/mock';
import { paths } from '@routes/paths';
import { Stagger, StaggerItem } from '@animations/Stagger';

/**
 * Animated category bento. Each tile uses its own gradient (defined in the
 * mock category record) so the row reads as a vibrant spectrum rather than
 * a single brand colour.
 *
 * Cards link straight into the catalog with a category filter pre-applied.
 */
export function CategoryShowcase() {
  return (
    <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {mockCategories.map((c) => (
        <StaggerItem key={c.slug}>
          <Link
            to={`${paths.products}?category=${c.slug}`}
            className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-ink-900/40 p-5 transition hover:border-white/25"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-15 transition-opacity duration-500 group-hover:opacity-30`}
            />
            <div className="relative flex h-32 flex-col justify-between">
              <motion.div
                aria-hidden
                className="h-12 w-12 rounded-2xl border border-white/15"
                style={{ background: `radial-gradient(circle at 30% 30%, ${c.accent}88, transparent 70%)` }}
                whileHover={{ rotate: 8, scale: 1.05 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.16em] text-ink-300">Shop</p>
                <p className="mt-1 flex items-center gap-1.5 font-display text-base font-semibold text-white">
                  {c.label}
                  <ArrowRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </p>
              </div>
            </div>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
