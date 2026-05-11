import { http } from '@services/http';
import { mapLoginResponse } from '@services/mappers';
import type {
  AuthSession,
  LoginPayload,
  RegisterPayload,
  User,
} from '@app-types/domain';

/**
 * Auth — talks to the gateway's /api/auth surface.
 *
 * The auth-service intentionally does NOT wrap login/signup in the platform
 * `ApiResponse<T>` envelope (it returns `LoginResponse` flat with
 * `accessToken` + `user` at top level). So this is the one service module
 * that hits `http` directly instead of `api`. Mappers translate the backend
 * shape into the frontend `AuthSession` / `User` domain.
 *
 * Logout is client-only — auth-service has no `/logout` endpoint by design
 * (JWT is stateless; clients drop the token and we're done).
 * Refresh + /me are placeholders the backend hasn't implemented yet; the
 * frontend keeps them so future wiring is a one-line change.
 */
export const authService = {
  login: (payload: LoginPayload) =>
    http.post('/api/auth/login', payload).then((r) => mapLoginResponse(r.data)),

  /**
   * Signup-then-login. The backend's /api/auth/signup returns just the new
   * user record (no token), so we chain a login call to produce the AuthSession
   * the rest of the frontend (auth slice, http interceptor) expects.
   */
  register: async (payload: RegisterPayload): Promise<AuthSession> => {
    await http.post('/api/auth/signup', payload);
    const loginRes = await http.post('/api/auth/login', {
      email:    payload.email,
      password: payload.password,
    });
    return mapLoginResponse(loginRes.data);
  },

  /**
   * Client-only logout — auth-service has no logout endpoint (stateless JWT).
   * Returning a resolved promise keeps the existing call sites intact.
   */
  logout: (): Promise<void> => Promise.resolve(),

  /**
   * `/me` and `/refresh` are not implemented on the backend yet. We leave the
   * functions defined so the auth slice can call them — they reject with a
   * non-network error and the UI's existing error handling kicks in.
   */
  me: (): Promise<User> => Promise.reject({ status: 501, message: 'auth-service /me not implemented' }),
  refresh: (_refreshToken: string): Promise<AuthSession> =>
    Promise.reject({ status: 501, message: 'auth-service /refresh not implemented' }),
};
