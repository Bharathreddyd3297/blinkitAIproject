import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { orderService } from '@services/orderService';
import { toApiError } from '@services/http';
import type { ApiError, Order, Paginated } from '@app-types/domain';

export interface OrdersState {
  list: Order[];
  pagination: { page: number; pageSize: number; total: number };
  byId: Record<string, Order>;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: ApiError | null;
}

const initialState: OrdersState = {
  list: [],
  pagination: { page: 1, pageSize: 10, total: 0 },
  byId: {},
  status: 'idle',
  error: null,
};

export const fetchOrders = createAsyncThunk<
  Paginated<Order>,
  { page?: number; pageSize?: number } | undefined,
  { rejectValue: ApiError }
>('orders/fetch', async (args, { rejectWithValue }) => {
  try {
    return await orderService.list(args?.page, args?.pageSize);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const fetchOrder = createAsyncThunk<Order, string, { rejectValue: ApiError }>(
  'orders/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      return await orderService.get(id);
    } catch (e) {
      return rejectWithValue(toApiError(e));
    }
  },
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchOrders.pending,   (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(fetchOrders.fulfilled, (s, a) => {
      s.status = 'success';
      s.list   = a.payload.items;
      s.pagination = {
        page:     a.payload.page,
        pageSize: a.payload.pageSize,
        total:    a.payload.total,
      };
      for (const o of a.payload.items) s.byId[o.id] = o;
    });
    b.addCase(fetchOrders.rejected,  (s, a) => {
      s.status = 'error';
      s.error  = a.payload ?? { status: 0, message: 'Failed to load orders' };
    });

    b.addCase(fetchOrder.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload; });
  },
});

export const { clearError } = ordersSlice.actions;
export const ordersReducer = ordersSlice.reducer;
