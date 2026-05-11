import { configureStore } from '@reduxjs/toolkit';

import { config } from '@app/config';
import { authReducer } from '@store/slices/authSlice';
import { productsReducer } from '@store/slices/productsSlice';
import { cartReducer } from '@store/slices/cartSlice';
import { ordersReducer } from '@store/slices/ordersSlice';
import { recommendationsReducer } from '@store/slices/recommendationsSlice';
import { checkoutReducer } from '@store/slices/checkoutSlice';
import { uiReducer } from '@store/slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth:            authReducer,
    products:        productsReducer,
    cart:            cartReducer,
    orders:          ordersReducer,
    recommendations: recommendationsReducer,
    checkout:        checkoutReducer,
    ui:              uiReducer,
  },
  devTools: config.features.devtools,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        // Allow our error envelope in rejected actions without warnings.
        ignoredActionPaths: ['payload.details', 'meta.arg'],
      },
    }),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
