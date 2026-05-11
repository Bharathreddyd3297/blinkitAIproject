import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import {
  Boxes,
  CreditCard,
  Heart,
  Home,
  LineChart,
  Package,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setSidebarOpen } from '@store/slices/uiSlice';
import { Logo } from '@components/primitives/Logo';
import { cn } from '@utils/cn';

const SECTIONS = [
  {
    title: 'Discover',
    items: [
      { to: '/',                label: 'Home',           icon: Home },
      { to: '/products',        label: 'All products',   icon: Boxes },
      { to: '/recommendations', label: 'For you',        icon: Sparkles },
    ],
  },
  {
    title: 'Activity',
    items: [
      { to: '/orders',  label: 'Orders',     icon: Package },
      { to: '/cart',    label: 'Cart',       icon: Heart },
      { to: '/checkout',label: 'Checkout',   icon: CreditCard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin', label: 'Admin console', icon: LineChart },
    ],
  },
];

/**
 * Slide-in sidebar foundation.
 *
 * Render at the layout root — it renders nothing when closed (so it doesn't
 * interfere with hit-testing). Keep it secondary to the navbar; this is the
 * "deep navigation" surface, not the primary one.
 */
export function Sidebar() {
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const dispatch = useAppDispatch();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => dispatch(setSidebarOpen(false))}
            className="fixed inset-0 z-40 bg-ink-950/55 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-0 top-0 z-50 flex h-full w-[300px] flex-col border-r border-white/10 bg-ink-900/85 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/8 p-5">
              <Logo />
              <button
                onClick={() => dispatch(setSidebarOpen(false))}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/20 hover:text-white"
                aria-label="Close sidebar"
              >
                <X size={14} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4">
              {SECTIONS.map((section) => (
                <div key={section.title} className="mb-6">
                  <p className="eyebrow mb-3 px-2">{section.title}</p>
                  <ul className="space-y-1">
                    {section.items.map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <NavLink
                          to={to}
                          onClick={() => dispatch(setSidebarOpen(false))}
                          className={({ isActive }) =>
                            cn(
                              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-200 transition',
                              'hover:bg-white/[0.05] hover:text-white',
                              isActive &&
                                'bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]',
                            )
                          }
                        >
                          <Icon size={15} className="opacity-80 group-hover:text-accent-glow" />
                          {label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="border-t border-white/8 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[0.7rem] text-ink-300">
                <ShieldCheck size={14} className="text-success" />
                Cloud-native · Gateway secured
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
