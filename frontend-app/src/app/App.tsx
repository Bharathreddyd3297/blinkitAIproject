import { useEffect } from 'react';
import { useAppDispatch } from '@store/hooks';
import { hydrateAuth } from '@store/slices/authSlice';
import { fetchCart } from '@store/slices/cartSlice';
import { AppRouter } from '@routes/AppRouter';
import { AmbientBackground } from '@components/visuals/AmbientBackground';

export function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Rehydrate auth state from localStorage on first paint so protected
    // routes don't flash through the public state on a hard refresh.
    dispatch(hydrateAuth());

    // Warm the cart so the navbar badge is correct immediately. The
    // cart-service falls back to a local cart when the gateway is down,
    // so this is safe even on cold-start without a backend.
    dispatch(fetchCart());

    // Drop the pre-hydration boot screen once React is mounted.
    const boot = document.querySelector('.boot-screen');
    if (boot) {
      boot.classList.add('boot-screen--leaving');
      setTimeout(() => boot.remove(), 320);
    }
  }, [dispatch]);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-ink-950 text-ink-100 antialiased">
      <AmbientBackground />
      <AppRouter />
    </div>
  );
}

export default App;
