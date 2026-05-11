import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';

import { useAuth } from '@hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { selectCartItemCount } from '@store/slices/cartSlice';
import {
  setCartDrawerOpen,
  setSearchOverlayOpen,
  toggleSidebar,
} from '@store/slices/uiSlice';
import { Container } from '@components/primitives/Container';
import { Logo } from '@components/primitives/Logo';
import { Button } from '@components/primitives/Button';
import { cn } from '@utils/cn';

const NAV_ITEMS = [
  { to: '/products',        label: 'Shop' },
  { to: '/recommendations', label: 'For You' },
  { to: '/orders',          label: 'Orders' },
];

/**
 * Floating glass navbar.
 *
 * Behaviour:
 *   - On scroll past 8px we tighten the chrome (smaller blur layer, denser
 *     shadow). Driven by a `scrolled` flag so motion stays declarative.
 *   - Active route gets a glowing pill behind the link via shared layoutId.
 *   - Mobile menu animates in from the top with the same easing curve.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAuth();
  const cartCount = useAppSelector(selectCartItemCount);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-3 z-40 w-full"
    >
      <Container>
        <div
          className={cn(
            'relative flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3 transition-all duration-400 ease-out-expo',
            'bg-ink-900/55 backdrop-blur-xl',
            scrolled
              ? 'shadow-[0_18px_50px_-22px_rgba(0,0,0,0.7)] border-white/15'
              : 'shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]',
          )}
        >
          {/* Left — sidebar toggle + logo */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/20 hover:text-white lg:inline-flex"
              aria-label="Toggle sidebar"
            >
              <Menu size={16} />
            </button>
            <Link to="/" className="group inline-flex items-center">
              <Logo />
            </Link>
          </div>

          {/* Center — primary nav (desktop) */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-xl px-3.5 py-2 text-[0.86rem] font-medium transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-ink-200 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_0_20px_-2px_rgba(155,107,255,0.45)]"
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    <span className="relative">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right — actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => dispatch(setSearchOverlayOpen(true))}
              className="hidden h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-ink-200 transition hover:border-white/20 hover:text-white sm:inline-flex"
              aria-label="Search"
            >
              <Search size={14} />
              <span className="hidden md:inline">Search</span>
              <span className="hidden rounded-md border border-white/10 px-1.5 text-[0.65rem] text-ink-300 md:inline">
                ⌘K
              </span>
            </button>

            <button
              onClick={() => dispatch(setCartDrawerOpen(true))}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/20 hover:text-white"
              aria-label={`Cart (${cartCount})`}
            >
              <ShoppingBag size={16} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-semibold text-white shadow-glow-sm">
                  {cartCount}
                </span>
              )}
            </button>

            {isAuthenticated ? (
              <Link
                to="/account"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-2.5 text-xs text-ink-100 transition hover:border-white/20 hover:text-white"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-accent to-neon-cyan text-[0.65rem] font-bold text-white">
                  {user?.name?.[0]?.toUpperCase() ?? <UserIcon size={12} />}
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">
                  {user?.name ?? 'Account'}
                </span>
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:inline-flex">
                <Button size="sm" variant="primary" iconLeft={<Sparkles size={14} />}>
                  Sign in
                </Button>
              </Link>
            )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/20 hover:text-white md:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 backdrop-blur-xl md:hidden"
            >
              <ul className="flex flex-col p-2">
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-200 transition',
                          'hover:bg-white/[0.04] hover:text-white',
                          isActive && 'bg-white/[0.06] text-white',
                        )
                      }
                    >
                      <Bell size={14} className="opacity-70" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <NavLink
                    to="/orders"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-200 transition hover:bg-white/[0.04] hover:text-white',
                        isActive && 'bg-white/[0.06] text-white',
                      )
                    }
                  >
                    <Package size={14} className="opacity-70" />
                    My orders
                  </NavLink>
                </li>
                {!isAuthenticated && (
                  <li className="p-2">
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      <Button size="md" fullWidth>
                        Sign in
                      </Button>
                    </Link>
                  </li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </motion.header>
  );
}
