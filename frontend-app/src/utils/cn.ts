import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn(...classes)` — the canonical class merger for this app.
 * `clsx` handles conditionals; `tailwind-merge` resolves Tailwind conflicts
 * (e.g. `p-2` + `p-4` → `p-4`) so prop-driven overrides actually win.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
