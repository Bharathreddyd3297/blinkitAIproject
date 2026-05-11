import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from '@store/store';

// Use these throughout the app instead of plain `useDispatch` / `useSelector`
// so types flow without an explicit annotation at every call site.
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
