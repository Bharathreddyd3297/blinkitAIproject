import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { orderService, type PlaceOrderPayload } from '@services/orderService';
import { paymentService } from '@services/paymentService';
import { toApiError } from '@services/http';
import type { ApiError, Order } from '@app-types/domain';

// =============================================================================
// Types
// =============================================================================

export type CheckoutStep = 'review' | 'shipping' | 'delivery' | 'payment' | 'confirmation';

export const STEP_ORDER: CheckoutStep[] = ['review', 'shipping', 'delivery', 'payment', 'confirmation'];

export type DeliverySpeed = 'express' | 'standard' | 'scheduled';

export interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type PaymentMethod = 'card' | 'upi' | 'wallet' | 'cod';

export interface CardDetails {
  cardholder: string;
  number: string;        // formatted with spaces, e.g. 4242 4242 4242 4242
  expiry: string;        // MM/YY
  cvc: string;
}

export type PaymentStatus = 'idle' | 'processing' | 'succeeded' | 'failed';

// =============================================================================
// State
// =============================================================================

const emptyAddress: ShippingAddress = {
  fullName: '', phone: '', street: '', landmark: '',
  city: '', state: '', postalCode: '', country: 'India',
};

const emptyCard: CardDetails = {
  cardholder: '',
  number: '',
  expiry: '',
  cvc: '',
};

export interface CheckoutState {
  step: CheckoutStep;
  address: ShippingAddress;
  selectedAddressId?: string;        // when picking from saved
  delivery: DeliverySpeed;
  paymentMethod: PaymentMethod;
  card: CardDetails;
  upiId: string;
  walletId?: string;
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  /** Set once an order is placed so the confirmation step can render it. */
  placedOrder: Order | null;
  placeError: ApiError | null;
}

const initialState: CheckoutState = {
  step: 'review',
  address: { ...emptyAddress },
  delivery: 'express',
  paymentMethod: 'card',
  card: { ...emptyCard },
  upiId: '',
  paymentStatus: 'idle',
  paymentError: null,
  placedOrder: null,
  placeError: null,
};

// =============================================================================
// Thunks
//
// `processAndPlace` is the conversion-critical operation. The backend's
// real flow is order-FIRST: /api/orders/checkout creates the order in
// CREATED state, then /api/payments/create binds a PENDING payment to that
// real numeric orderId, then /api/payments/process settles it (and the
// payment-service patches the order to PAID/FAILED). Doing payment first
// would only work against the legacy mock, because /payments/create
// requires a real backend orderId that doesn't exist until checkout runs.
// If payment fails after the order is created, the backend auto-marks the
// order FAILED; the UI just surfaces the rejection.
// =============================================================================

interface ProcessArgs {
  payload: PlaceOrderPayload;
  /** Demo escape hatch: when true, bypass the random 6% failure simulation. */
  forceSucceed?: boolean;
}

const toBackendPaymentMethod = (m: PaymentMethod): string => {
  switch (m) {
    case 'card':   return 'CARD';
    case 'upi':    return 'UPI';
    case 'wallet': return 'WALLET';
    case 'cod':    return 'COD';
  }
};

export const processAndPlace = createAsyncThunk<
  Order,
  ProcessArgs,
  { rejectValue: ApiError; state: { checkout: CheckoutState } }
>('checkout/processAndPlace', async ({ payload, forceSucceed }, { getState, rejectWithValue }) => {
  try {
    const order = await orderService.place(payload);
    const method = toBackendPaymentMethod(getState().checkout.paymentMethod);
    const intent = await paymentService.createIntent(payload.total.amount, order.id, method);
    const confirmed = await paymentService.confirm(intent.id, forceSucceed);
    if (confirmed.status !== 'succeeded') {
      return rejectWithValue({
        status: 402,
        message: 'Payment was declined. Please try a different method.',
        code: 'PAYMENT_DECLINED',
      });
    }
    return { ...order, status: 'CONFIRMED' };
  } catch (e) {
    return rejectWithValue(toApiError(e));
  }
});

// =============================================================================
// Slice
// =============================================================================

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    setStep(state, action: PayloadAction<CheckoutStep>) {
      state.step = action.payload;
    },
    nextStep(state) {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx >= 0 && idx < STEP_ORDER.length - 1) state.step = STEP_ORDER[idx + 1];
    },
    prevStep(state) {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx > 0) state.step = STEP_ORDER[idx - 1];
    },
    setAddress(state, action: PayloadAction<Partial<ShippingAddress>>) {
      state.address = { ...state.address, ...action.payload };
    },
    selectSavedAddress(state, action: PayloadAction<{ id: string; address: ShippingAddress }>) {
      state.selectedAddressId = action.payload.id;
      state.address = { ...action.payload.address };
    },
    setDelivery(state, action: PayloadAction<DeliverySpeed>) {
      state.delivery = action.payload;
    },
    setPaymentMethod(state, action: PayloadAction<PaymentMethod>) {
      state.paymentMethod = action.payload;
    },
    setCard(state, action: PayloadAction<Partial<CardDetails>>) {
      state.card = { ...state.card, ...action.payload };
    },
    setUpiId(state, action: PayloadAction<string>) {
      state.upiId = action.payload;
    },
    resetPaymentStatus(state) {
      state.paymentStatus = 'idle';
      state.paymentError = null;
      state.placeError = null;
    },
    /** Wipe everything once the user navigates away from the confirmation. */
    resetCheckout(state) {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (b) => {
    b.addCase(processAndPlace.pending, (s) => {
      s.paymentStatus = 'processing';
      s.paymentError  = null;
      s.placeError    = null;
    });
    b.addCase(processAndPlace.fulfilled, (s, a) => {
      s.paymentStatus = 'succeeded';
      s.placedOrder   = a.payload;
      s.step          = 'confirmation';
    });
    b.addCase(processAndPlace.rejected, (s, a) => {
      s.paymentStatus = 'failed';
      s.paymentError  = a.payload?.message ?? 'Payment failed';
      s.placeError    = a.payload ?? null;
    });
  },
});

export const {
  setStep,
  nextStep,
  prevStep,
  setAddress,
  selectSavedAddress,
  setDelivery,
  setPaymentMethod,
  setCard,
  setUpiId,
  resetPaymentStatus,
  resetCheckout,
} = checkoutSlice.actions;

export const checkoutReducer = checkoutSlice.reducer;

// =============================================================================
// Selectors + helpers
// =============================================================================

export const isAddressValid = (a: ShippingAddress): boolean =>
  a.fullName.trim().length >= 2 &&
  /^\+?\d[\d\s]{7,}$/.test(a.phone.trim()) &&
  a.street.trim().length >= 4 &&
  a.city.trim().length >= 2 &&
  a.state.trim().length >= 2 &&
  /^\d{4,8}$/.test(a.postalCode.trim());

export const isCardValid = (c: CardDetails): boolean => {
  const digits = c.number.replace(/\s+/g, '');
  return (
    c.cardholder.trim().length >= 2 &&
    /^\d{13,19}$/.test(digits) &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(c.expiry) &&
    /^\d{3,4}$/.test(c.cvc)
  );
};

export const isUpiValid = (vpa: string): boolean =>
  /^[\w.-]{2,}@[\w.-]{2,}$/.test(vpa.trim());

export const DELIVERY_OPTIONS = [
  {
    speed: 'express' as DeliverySpeed,
    label: 'Express delivery',
    eta: 'Within 30 min',
    etaMinutes: 30,
    price: 0,
    description: 'Curated for groceries and essentials. Real-time dispatch.',
  },
  {
    speed: 'standard' as DeliverySpeed,
    label: 'Standard delivery',
    eta: 'Same day Â· evening',
    etaMinutes: 240,
    price: 0,
    description: 'Free, no-rush option. Lower carbon route.',
  },
  {
    speed: 'scheduled' as DeliverySpeed,
    label: 'Scheduled delivery',
    eta: 'You pick the slot',
    etaMinutes: 1440,
    price: 0,
    description: 'Plan ahead â€” pick a 2-hour window any time this week.',
  },
];
