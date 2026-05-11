import { useAppDispatch } from '@store/hooks';
import { pushToast, type Toast } from '@store/slices/uiSlice';

/**
 * Tiny ergonomic wrapper over `pushToast`. Components should never construct
 * a toast object themselves — go through this hook so the variant taxonomy
 * stays consistent across the app.
 */
export function useToast() {
  const dispatch = useAppDispatch();
  const fire = (toast: Omit<Toast, 'id'>) => dispatch(pushToast(toast));

  return {
    info:    (title: string, message?: string) => fire({ variant: 'info',    title, message }),
    success: (title: string, message?: string) => fire({ variant: 'success', title, message }),
    warning: (title: string, message?: string) => fire({ variant: 'warning', title, message }),
    error:   (title: string, message?: string) => fire({ variant: 'error',   title, message, durationMs: 6000 }),
  };
}
