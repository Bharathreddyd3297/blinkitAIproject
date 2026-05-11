/**
 * Tiny typed wrapper over localStorage.
 *
 * Why bother with a wrapper? Two reasons:
 *   1. Safari private mode and SSR throw on localStorage access — this swallows
 *      those errors so callers get `null` instead of having to try/catch.
 *   2. JSON parsing happens here, so callers don't write the same five-line
 *      try/catch every time they want to persist a typed value.
 */

const safeWindow = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const storage = {
  get<T>(key: string): T | null {
    const ls = safeWindow();
    if (!ls) return null;
    try {
      const raw = ls.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    const ls = safeWindow();
    if (!ls) return;
    try {
      ls.setItem(key, JSON.stringify(value));
    } catch {
      // Out of quota / private mode — silently degrade.
    }
  },

  remove(key: string): void {
    const ls = safeWindow();
    if (!ls) return;
    try {
      ls.removeItem(key);
    } catch {
      /* noop */
    }
  },
};
