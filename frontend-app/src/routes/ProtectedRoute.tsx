import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAppSelector } from '@store/hooks';
import {
  selectHydrated,
  selectIsAuthenticated,
  selectUser,
} from '@store/slices/authSlice';
import { FullPageLoader } from '@components/loading/FullPageLoader';
import type { Role } from '@app-types/domain';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If specified, user must hold at least one of these roles. */
  roles?: Role[];
  /** Where to redirect unauthenticated users. */
  redirectTo?: string;
}

/**
 * Auth + role guard for routes.
 *
 * NOTE: Wait for `hydrated` before deciding. Without that gate, a hard refresh
 * briefly renders as unauthenticated and bounces a real user to /login â€”
 * a classic flash-of-public-state bug. We block the render until the auth
 * slice has read localStorage.
 */
export function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const hydrated        = useAppSelector(selectHydrated);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user            = useAppSelector(selectUser);
  const location        = useLocation();

  if (!hydrated) return <FullPageLoader label="Authenticating" />;

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  if (roles && !roles.some((r) => user.roles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
