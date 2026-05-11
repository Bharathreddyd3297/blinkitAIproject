import {
  createAsyncThunk,
  createSlice,
} from '@reduxjs/toolkit';

import { productService } from '@services/productService';
import { toApiError } from '@services/http';
import type {
  ApiError,
  Paginated,
  Product,
  ProductFilters,
} from '@app-types/domain';

export interface ProductsState {
  list: Product[];
  pagination: { page: number; pageSize: number; total: number };
  filters: ProductFilters;
  byId: Record<string, Product>;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: ApiError | null;
}

const initialState: ProductsState = {
  list: [],
  pagination: { page: 1, pageSize: 24, total: 0 },
  filters: { sort: 'relevance', page: 1, pageSize: 24 },
  byId: {},
  status: 'idle',
  error: null,
};

export const fetchProducts = createAsyncThunk<
  Paginated<Product>,
  ProductFilters | undefined,
  { rejectValue: ApiError }
>('products/fetch', async (filters, { rejectWithValue }) => {
  try {
    return await productService.list(filters);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const fetchProduct = createAsyncThunk<
  Product,
  string,
  { rejectValue: ApiError }
>('products/fetchOne', async (slug, { rejectWithValue }) => {
  try {
    return await productService.getBySlug(slug);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setFilters(state, action: { payload: Partial<ProductFilters> }) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchProducts.pending,   (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(fetchProducts.fulfilled, (s, a) => {
      s.status = 'success';
      s.list   = a.payload.items;
      s.pagination = {
        page:     a.payload.page,
        pageSize: a.payload.pageSize,
        total:    a.payload.total,
      };
      for (const p of a.payload.items) s.byId[p.id] = p;
    });
    b.addCase(fetchProducts.rejected,  (s, a) => {
      s.status = 'error';
      s.error  = a.payload ?? { status: 0, message: 'Failed to load products' };
    });

    b.addCase(fetchProduct.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload; });
  },
});

export const { setFilters, clearError } = productsSlice.actions;
export const productsReducer = productsSlice.reducer;
