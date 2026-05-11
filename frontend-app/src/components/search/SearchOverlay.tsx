import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CornerDownLeft, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setSearchOverlayOpen } from '@store/slices/uiSlice';
import { useKeyboardShortcut } from '@hooks/useKeyboardShortcut';
import { productService } from '@services/productService';
import { mockCategories } from '@utils/mock';
import { paths } from '@routes/paths';
import { formatMoney } from '@utils/format';
import type { Product } from '@app-types/domain';
import { cn } from '@utils/cn';

/**
 * Premium command-palette-style search.
 *
 * - Open with cmd/ctrl+k from anywhere; close with Esc or scrim click.
 * - Debounced query (140ms) hits the product-service through the gateway.
 * - Up/Down/Enter to navigate without leaving the keyboard.
 * - Architecturally ready for AI semantic search: swap the `productService.search`
 *   call for an `aiSearchService.semantic(query)` and the rest stays put.
 */
export function SearchOverlay() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((s) => s.ui.searchOverlayOpen);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  // Open with cmd+k from anywhere on the app.
  useKeyboardShortcut(
    'k',
    () => dispatch(setSearchOverlayOpen(true)),
    { modOrCtrl: true, ignoreEditable: false },
  );

  // Auto-focus the input when the overlay opens.
  useEffect(() => {
    if (open) {
      // RAF â€” wait for the panel mount transition to start so the focus ring
      // doesn't render mid-transform.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
      setResults([]);
      setActive(0);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const page = await productService.search(trimmed, 8);
        if (!cancelled) {
          setResults(page.items);
          setActive(0);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => dispatch(setSearchOverlayOpen(false));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active];
      if (r) {
        navigate(paths.productDetail(r.slug));
        close();
      }
    }
  };

  const showCategoryHints = query.trim().length < 2;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="search-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={close}
            className="fixed inset-0 z-[55] bg-ink-950/65 backdrop-blur-md"
          />
          <motion.div
            key="search-panel"
            role="dialog"
            aria-label="Search"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 8,    scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[12vh] z-[60] w-[min(92vw,720px)] -translate-x-1/2"
          >
            <div className="glass-strong overflow-hidden rounded-3xl border border-white/12 shadow-glass-lg">
              {/* Input */}
              <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
                <Search size={16} className="text-ink-300" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search products, brands, categoriesâ€¦"
                  className="flex-1 bg-transparent text-base text-ink-50 placeholder:text-ink-400 focus:outline-none"
                  autoFocus
                />
                {searching && <span className="text-[0.7rem] text-ink-300">Searchingâ€¦</span>}
                <button
                  onClick={close}
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink-300 transition hover:text-white"
                  aria-label="Close search"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-3">
                {showCategoryHints ? (
                  <CategoryHints onPick={close} />
                ) : results.length === 0 && !searching ? (
                  <EmptyState query={query} />
                ) : (
                  <ul className="space-y-1">
                    {results.map((p, i) => (
                      <li key={p.id}>
                        <Link
                          to={paths.productDetail(p.slug)}
                          onClick={close}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition',
                            i === active
                              ? 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(155,107,255,0.35)]'
                              : 'hover:bg-white/[0.04]',
                          )}
                        >
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-ink-900/60">
                            {p.imageUrl && (
                              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white">{p.name}</p>
                            <p className="truncate text-xs text-ink-300">
                              {p.brand} Â· {p.category}
                            </p>
                          </div>
                          <span className="font-display text-sm font-semibold text-white">
                            {formatMoney(p.price)}
                          </span>
                          <ArrowUpRight size={14} className="text-ink-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/8 px-5 py-3 text-[0.7rem] text-ink-300">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={11} className="text-accent-glow" />
                  AI semantic search Â· coming soon
                </span>
                <span className="inline-flex items-center gap-2">
                  <Kbd>â†‘</Kbd><Kbd>â†“</Kbd> navigate
                  <Kbd><CornerDownLeft size={10} /></Kbd> open
                  <Kbd>Esc</Kbd> close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-200">
      {children}
    </kbd>
  );
}

function CategoryHints({ onPick }: { onPick: () => void }) {
  return (
    <div>
      <p className="px-3 pb-2 pt-1 text-[0.7rem] uppercase tracking-[0.16em] text-ink-300">Browse by category</p>
      <ul className="grid grid-cols-2 gap-1">
        {mockCategories.map((c) => (
          <li key={c.slug}>
            <Link
              to={`${paths.products}?category=${c.slug}`}
              onClick={onPick}
              className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-ink-100 transition hover:bg-white/[0.04]"
            >
              <span>{c.label}</span>
              <ArrowUpRight size={14} className="text-ink-300" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="grid place-items-center py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-ink-200">
        <Search size={16} />
      </div>
      <p className="mt-3 font-display text-base text-white">No matches for â€œ{query}â€</p>
      <p className="mt-1 text-sm text-ink-300">
        Try a different keyword, or browse by category.
      </p>
    </div>
  );
}

