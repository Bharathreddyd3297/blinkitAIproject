import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import { config } from '@app/config';
import { authService } from '@services/authService';
import { setAuthRefreshHandler, toApiError } from '@services/http';
import { storage } from '@utils/storage';
import type {
  ApiError,
  AuthSession,
  LoginPayload,
  RegisterPayload,
  User,
} from '@app-types/domain';

// =============================================================================
// State
// =============================================================================

export interface AuthState {
  session: AuthSession | null;
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: ApiError | null;
  hydrated: boolean; // true once we've checked localStorage on boot
}

const initialState: AuthState = {
  session:  null,
  user:     null,
  status:   'idle',
  error:    null,
  hydrated: false,
};

// =============================================================================
// Persistence helpers
// =============================================================================

const persist   = (s: AuthSession) => storage.set(config.auth.storageKey, s);
const wipe      = ()              => storage.remove(config.auth.storageKey);
const readPersisted = () => storage.get<AuthSession>(config.auth.storageKey);

// =============================================================================
// Thunks
// =============================================================================

export const login = createAsyncThunk<
  AuthSession,
  LoginPayload,
  { rejectValue: ApiError }
>('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const session = await authService.login(payload);
    persist(session);
    return session;
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const register = createAsyncThunk<
  AuthSession,
  RegisterPayload,
  { rejectValue: ApiError }
>('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const session = await authService.register(payload);
    persist(session);
    return session;
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const logout = createAsyncThunk<void, void>(
  'auth/logout',
  async () => {
    try { await authService.logout(); } catch { /* best-effort */ }
    wipe();
  },
);

// =============================================================================
// Slice
// =============================================================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Re-read the session from localStorage. Called once on app boot from
     * <App> so a hard refresh keeps the user logged in without a flash of
     * the public state.
     */
    hydrateAuth(state) {
      const persisted = readPersisted();
      state.hydrated = true;
      if (persisted) {
        state.session = persisted;
        state.user    = persisted.user;
        state.status  = 'authenticated';
      }
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      if (state.session) {
        state.session.user = action.payload;
        persist(state.session);
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending,    (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(login.fulfilled,  (s, a) => {
      s.status = 'authenticated';
      s.session = a.payload;
      s.user    = a.payload.user;
    });
    b.addCase(login.rejected,   (s, a) => {
      s.status = 'error';
      s.error  = a.payload ?? { status: 0, message: 'Login failed' };
    });

    b.addCase(register.pending,   (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(register.fulfilled, (s, a) => {
      s.status = 'authenticated';
      s.session = a.payload;
      s.user    = a.payload.user;
    });
    b.addCase(register.rejected,  (s, a) => {
      s.status = 'error';
      s.error  = a.payload ?? { status: 0, message: 'Registration failed' };
    });

    b.addCase(logout.fulfilled, (s) => {
      s.session = null;
      s.user    = null;
      s.status  = 'idle';
      s.error   = null;
    });
  },
});

export const { hydrateAuth, setUser, clearError } = authSlice.actions;
export const authReducer = authSlice.reducer;

// =============================================================================
// Selectors
// =============================================================================

export const selectIsAuthenticated = (s: { auth: AuthState }) =>
  s.auth.status === 'authenticated' && !!s.auth.session;
export const selectUser     = (s: { auth: AuthState }) => s.auth.user;
export const selectAuthErr  = (s: { auth: AuthState }) => s.auth.error;
export const selectHydrated = (s: { auth: AuthState }) => s.auth.hydrated;

// =============================================================================
// Refresh handler registration
//
// We register *here* (not in http.ts) so the network module stays free of
// any Redux dependency. http.ts just calls the handler when it sees a 401.
// =============================================================================
setAuthRefreshHandler(async () => {
  const session = readPersisted();
  if (!session?.refreshToken) return null;
  try {
    const next = await authService.refresh(session.refreshToken);
    persist(next);
    return next.token;
  } catch {
    wipe();
    return null;
  }
});
