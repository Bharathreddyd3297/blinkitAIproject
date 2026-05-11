import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  login,
  logout,
  register,
  selectAuthErr,
  selectIsAuthenticated,
  selectUser,
} from '@store/slices/authSlice';
import type {
  LoginPayload,
  RegisterPayload,
  Role,
} from '@app-types/domain';

/**
 * High-level auth hook. Components should never call the auth slice directly;
 * route through here so we have a single ergonomic surface to evolve.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const user            = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const error           = useAppSelector(selectAuthErr);

  return {
    user,
    isAuthenticated,
    error,
    hasRole: (role: Role) => !!user?.roles.includes(role),
    hasAnyRole: (roles: Role[]) =>
      !!user && roles.some((r) => user.roles.includes(r)),
    login:    (payload: LoginPayload)    => dispatch(login(payload)).unwrap(),
    register: (payload: RegisterPayload) => dispatch(register(payload)).unwrap(),
    logout:   ()                         => dispatch(logout()).unwrap(),
  };
}
