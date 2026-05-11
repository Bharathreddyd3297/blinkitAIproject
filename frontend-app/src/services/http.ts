import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { config } from '@app/config';
import { storage } from '@utils/storage';
import type { ApiError, AuthSession } from '@app-types/domain';

/**
 * The single Axios instance the entire app uses.
 *
 * IMPORTANT: This is the only network client in the codebase. Every service
 * module imports `http` from here â€” they MUST NOT spin up their own client.
 * That's how we keep one place to wire auth, telemetry, retries, and base URL.
 *
 * The frontend talks ONLY to the API gateway (config.api.baseUrl). Direct
 * service URLs are forbidden â€” the gateway is the contract boundary.
 */

export const http: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    'X-Client':     `${config.app.name}/${config.app.version}`,
  },
});

// =============================================================================
// Refresh-ready token plumbing
// =============================================================================
//
// We expose a tiny pluggable hook so the auth slice can register its own
// refresh strategy without this file taking a hard dependency on Redux.
// When the backend wires up a /auth/refresh endpoint, the auth module just
// implements `setAuthRefreshHandler` and we're done â€” nothing else changes.

type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export const setAuthRefreshHandler = (handler: RefreshHandler | null) => {
  refreshHandler = handler;
};

const getStoredToken = (): string | null => {
  const session = storage.get<AuthSession>(config.auth.storageKey);
  return session?.token ?? null;
};

// =============================================================================
// Request interceptor â€” JWT injection + correlation id
// =============================================================================

http.interceptors.request.use((req: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token && !req.headers.has('Authorization')) {
    req.headers.set('Authorization', `Bearer ${token}`);
  }
  // Correlation id helps backend tracing tie a frontend action to a span.
  req.headers.set('X-Request-Id', crypto.randomUUID());
  return req;
});

// =============================================================================
// Response interceptor â€” normalize errors + attempt single-flight refresh
// =============================================================================

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

http.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as RetriableConfig | undefined;

    // 401 path: try one refresh if a handler is registered. Multiple in-flight
    // requests share the same refresh promise so we don't stampede the server.
    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      refreshHandler
    ) {
      original._retry = true;
      try {
        refreshInFlight ??= refreshHandler();
        const newToken = await refreshInFlight;
        refreshInFlight = null;
        if (newToken) {
          original.headers = {
            ...(original.headers ?? {}),
            Authorization: `Bearer ${newToken}`,
          };
          return http.request(original);
        }
      } catch {
        refreshInFlight = null;
        // Fall through to the normalised rejection below.
      }
    }

    return Promise.reject(toApiError(err));
  },
);

// =============================================================================
// Helpers
// =============================================================================

export const toApiError = (err: unknown): ApiError => {
  // Idempotency: the http response interceptor already wraps AxiosError into
  // ApiError before rejecting. Anything caught further up the chain (thunks,
  // service functions) is therefore an ApiError. Wrapping it a second time
  // would land in the AxiosError-false / Error-false fallback and emit the
  // literal string "Unknown error" — losing the real backend message.
  if (
    err && typeof err === 'object' &&
    'status' in err && 'message' in err && !(err instanceof Error)
  ) {
    return err as ApiError;
  }

  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const data = err.response?.data as
      | {
          message?: string;
          code?: string;
          error?: string;                      // ApiResponse envelope uses `error`
          details?: Record<string, unknown>;
          errors?: Record<string, string>;     // backend validation map: {field: msg}
        }
      | undefined;

    // Backend validation errors come back as
    //   { message: "Validation failed", errors: { password: "...", email: "..." } }
    // Surfacing only "Validation failed" leaves the user blind. Flatten the
    // field map into the message so every form gets a usable error without
    // having to know our envelope shape.
    const fieldErrors =
      data?.errors && typeof data.errors === 'object'
        ? Object.values(data.errors).filter(Boolean).join(' • ')
        : null;

    return {
      status,
      message:
        fieldErrors ??
        data?.message ??
        err.message ??
        (status === 0 ? 'Network error — gateway unreachable' : 'Request failed'),
      code:    data?.code ?? data?.error,
      details: (data?.details ?? data?.errors) as Record<string, unknown> | undefined,
    };
  }
  return {
    status: 0,
    message: err instanceof Error ? err.message : 'Unknown error',
  };
};

/** Type-narrow a thrown value to ApiError. */
export const isApiError = (e: unknown): e is ApiError =>
  typeof e === 'object' && e !== null && 'status' in e && 'message' in e;
