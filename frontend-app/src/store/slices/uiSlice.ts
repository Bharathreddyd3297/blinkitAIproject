import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Cross-cutting UI state — sidebar, cart drawer, search overlay, toasts.
 *
 * Keep this lean. Anything that's only relevant to a single component should
 * stay as local React state, not bloat the global store. We do put cart
 * drawer / search overlay here because they're triggered from multiple
 * places (navbar, keyboard shortcuts, cart pages).
 */

export type Toast = {
  id: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  durationMs?: number;
};

export interface UIState {
  sidebarOpen: boolean;
  cartDrawerOpen: boolean;
  searchOverlayOpen: boolean;
  commandPaletteOpen: boolean;
  toasts: Toast[];
}

const initialState: UIState = {
  sidebarOpen: false,
  cartDrawerOpen: false,
  searchOverlayOpen: false,
  commandPaletteOpen: false,
  toasts: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },

    setCartDrawerOpen(state, action: PayloadAction<boolean>) {
      state.cartDrawerOpen = action.payload;
    },
    toggleCartDrawer(state) { state.cartDrawerOpen = !state.cartDrawerOpen; },

    setSearchOverlayOpen(state, action: PayloadAction<boolean>) {
      state.searchOverlayOpen = action.payload;
    },
    toggleSearchOverlay(state) { state.searchOverlayOpen = !state.searchOverlayOpen; },

    setCommandPaletteOpen(state, action: PayloadAction<boolean>) {
      state.commandPaletteOpen = action.payload;
    },

    pushToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload);
      },
      // Action creator generates the id so callers can stay synchronous.
      prepare(toast: Omit<Toast, 'id'>) {
        return { payload: { ...toast, id: crypto.randomUUID() } };
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  setSidebarOpen,
  toggleSidebar,
  setCartDrawerOpen,
  toggleCartDrawer,
  setSearchOverlayOpen,
  toggleSearchOverlay,
  setCommandPaletteOpen,
  pushToast,
  dismissToast,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
