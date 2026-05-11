import {
  createAsyncThunk,
  createSlice,
} from '@reduxjs/toolkit';

import { cartService } from '@services/cartService';
import { toApiError } from '@services/http';
import type { ApiError, Cart } from '@app-types/domain';

export interface CartState {
  cart: Cart | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: ApiError | null;
}

const initialState: CartState = {
  cart: null,
  status: 'idle',
  error: null,
};

export const fetchCart = createAsyncThunk<Cart, void, { rejectValue: ApiError }>(
  'cart/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await cartService.get();
    } catch (e) {
      return rejectWithValue(toApiError(e));
    }
  },
);

export const addCartItem = createAsyncThunk<
  Cart,
  { productId: string; quantity?: number },
  { rejectValue: ApiError }
>('cart/add', async ({ productId, quantity = 1 }, { rejectWithValue }) => {
  try {
    return await cartService.addItem(productId, quantity);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const updateCartItem = createAsyncThunk<
  Cart,
  { productId: string; quantity: number },
  { rejectValue: ApiError }
>('cart/update', async ({ productId, quantity }, { rejectWithValue }) => {
  try {
    return await cartService.updateItem(productId, quantity);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

export const removeCartItem = createAsyncThunk<
  Cart,
  string,
  { rejectValue: ApiError }
>('cart/remove', async (productId, { rejectWithValue }) => {
  try {
    return await cartService.removeItem(productId);
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    const setCart = (s: CartState, c: Cart) => {
      s.status = 'success';
      s.cart   = c;
    };
    b.addCase(fetchCart.pending,        (s) => { s.status = 'loading'; s.error = null; });
    b.addCase(fetchCart.fulfilled,      (s, a) => setCart(s, a.payload));
    b.addCase(addCartItem.fulfilled,    (s, a) => setCart(s, a.payload));
    b.addCase(updateCartItem.fulfilled, (s, a) => setCart(s, a.payload));
    b.addCase(removeCartItem.fulfilled, (s, a) => setCart(s, a.payload));

    [fetchCart, addCartItem, updateCartItem, removeCartItem].forEach((t) => {
      b.addCase(t.rejected, (s, a) => {
        s.status = 'error';
        s.error  = a.payload ?? { status: 0, message: 'Cart operation failed' };
      });
    });
  },
});

export const { clearError } = cartSlice.actions;
export const cartReducer = cartSlice.reducer;

export const selectCartItemCount = (s: { cart: CartState }) =>
  s.cart.cart?.items.reduce((acc, i) => acc + i.quantity, 0) ?? 0;
