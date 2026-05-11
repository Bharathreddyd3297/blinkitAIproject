import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';

import { Navbar } from '@layouts/Navbar';
import { Footer } from '@layouts/Footer';
import { Sidebar } from '@layouts/Sidebar';
import { PageTransition } from '@animations/PageTransition';
import { RouteFallback } from '@components/loading/RouteFallback';
import { CartDrawer } from '@components/cart/CartDrawer';
import { SearchOverlay } from '@components/search/SearchOverlay';
import { Toaster } from '@components/feedback/Toaster';

/**
 * The default app shell wrapping every public + protected route.
 *
 * Why this lives in its own file:
 *   - The router decides WHICH page renders; this decides WHERE pages render.
 *   - Suspense boundary here means lazy chunks fall back to a cinematic
 *     loader inside the layout — the navbar/footer never blink.
 */
export function MainLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Sidebar />
      <Navbar />

      <main className="relative flex-1">
        <AnimatePresence mode="wait">
          <Suspense fallback={<RouteFallback />}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </Suspense>
        </AnimatePresence>
      </main>

      <Footer />

      {/* Global overlays — single mount, dispatched from anywhere via uiSlice. */}
      <CartDrawer />
      <SearchOverlay />
      <Toaster />
    </div>
  );
}
