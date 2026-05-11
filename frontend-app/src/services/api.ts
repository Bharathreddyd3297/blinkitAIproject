/**
 * Thin wrapper around `http` for the Blinkit backend.
 *
 * Two responsibilities only:
 *   1. Prepend `/api` to every URL — the gateway routes only `/api/**`.
 *   2. Unwrap the platform-wide `ApiResponse<T>` envelope so callers see the
 *      raw `data` payload they actually want.
 *
 * The shape returned by every backend endpoint is
 *
 *     { success, message, data, timestamp }
 *
 * With one exception: `auth-service` returns `LoginResponse` flat (token + user
 * at the top level). That single endpoint uses `http` directly in
 * `authService.ts`.
 *
 * Anything 4xx still throws an `ApiError` via the http response interceptor —
 * `withMockFallback` only kicks in on `status === 0` (network unreachable).
 */

import { http } from '@services/http';
import type { AxiosRequestConfig } from 'axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
  error?: string;
  status?: number;
  path?: string;
}

const path = (p: string) => (p.startsWith('/api/') ? p : `/api${p.startsWith('/') ? '' : '/'}${p}`);

const unwrap = <T,>(envelope: ApiEnvelope<T> | undefined): T => {
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return envelope.data as T;
  }
  return envelope as unknown as T;
};

export const api = {
  get: <T,>(url: string, config?: AxiosRequestConfig) =>
    http.get<ApiEnvelope<T>>(path(url), config).then((r) => unwrap<T>(r.data)),

  post: <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    http.post<ApiEnvelope<T>>(path(url), body, config).then((r) => unwrap<T>(r.data)),

  put: <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    http.put<ApiEnvelope<T>>(path(url), body, config).then((r) => unwrap<T>(r.data)),

  patch: <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    http.patch<ApiEnvelope<T>>(path(url), body, config).then((r) => unwrap<T>(r.data)),

  delete: <T,>(url: string, config?: AxiosRequestConfig) =>
    http.delete<ApiEnvelope<T>>(path(url), config).then((r) => unwrap<T>(r.data)),
};
