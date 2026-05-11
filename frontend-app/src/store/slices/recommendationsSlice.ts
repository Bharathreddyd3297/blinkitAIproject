import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { recommendationService } from '@services/recommendationService';
import { toApiError } from '@services/http';
import type { ApiError, Recommendation } from '@app-types/domain';

export interface RecommendationsState {
  forYou: Recommendation[];
  trending: Recommendation[];
  similar: Record<string, Recommendation[]>;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: ApiError | null;
}

const initialState: RecommendationsState = {
  forYou: [],
  trending: [],
  similar: {},
  status: 'idle',
  error: null,
};

export const fetchForYou = createAsyncThunk<
  Recommendation[],
  number | undefined,
  { rejectValue: ApiError }
>('rec/forYou', async (limit, { rejectWithValue }) => {
  try {
    return await recommendationService.forUser(limit);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const fetchTrending = createAsyncThunk<
  Recommendation[],
  number | undefined,
  { rejectValue: ApiError }
>('rec/trending', async (limit, { rejectWithValue }) => {
  try {
    return await recommendationService.trending(limit);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const fetchSimilar = createAsyncThunk<
  { productId: string; recs: Recommendation[] },
  { productId: string; limit?: number },
  { rejectValue: ApiError }
>('rec/similar', async ({ productId, limit }, { rejectWithValue }) => {
  try {
    const recs = await recommendationService.similar(productId, limit);
    return { productId, recs };
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

const recommendationsSlice = createSlice({
  name: 'recommendations',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchForYou.pending,    (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(fetchForYou.fulfilled,  (s, a) => { s.status = 'success'; s.forYou = a.payload; });
    b.addCase(fetchTrending.fulfilled,(s, a) => { s.trending = a.payload; });
    b.addCase(fetchSimilar.fulfilled, (s, a) => {
      s.similar[a.payload.productId] = a.payload.recs;
    });

    [fetchForYou, fetchTrending, fetchSimilar].forEach((t) => {
      b.addCase(t.rejected, (s, a) => {
        s.status = 'error';
        s.error  = a.payload ?? { status: 0, message: 'Recommendations failed' };
      });
    });
  },
});

export const { clearError } = recommendationsSlice.actions;
export const recommendationsReducer = recommendationsSlice.reducer;
