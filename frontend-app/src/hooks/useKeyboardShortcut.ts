import { useEffect } from 'react';

interface ShortcutOptions {
  meta?: boolean;  // Cmd on macOS / Win key
  ctrl?: boolean;  // Ctrl on Windows / Linux
  shift?: boolean;
  alt?: boolean;
  /** Set to true to match either meta OR ctrl — the typical "command modifier" pattern. */
  modOrCtrl?: boolean;
  /** Skip when the user is typing in an input/textarea/contenteditable. */
  ignoreEditable?: boolean;
}

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
};

/**
 * Register a keyboard shortcut for the duration of a component's mount.
 *
 * Example — open the search overlay with cmd+k / ctrl+k:
 *   useKeyboardShortcut('k', () => dispatch(toggleSearchOverlay()), { modOrCtrl: true });
 */
export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts: ShortcutOptions = {},
) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (opts.ignoreEditable && isEditable(e.target)) return;
      if (opts.modOrCtrl && !(e.metaKey || e.ctrlKey)) return;
      if (opts.meta  && !e.metaKey)  return;
      if (opts.ctrl  && !e.ctrlKey)  return;
      if (opts.shift && !e.shiftKey) return;
      if (opts.alt   && !e.altKey)   return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      handler(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handler, opts.meta, opts.ctrl, opts.shift, opts.alt, opts.modOrCtrl, opts.ignoreEditable]);
}
