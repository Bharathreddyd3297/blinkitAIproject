import { api } from '@services/api';
import {
  confirmMockPaymentIntent,
  createMockPaymentIntent,
  withMockFallback,
} from '@utils/mock';

/**
 * Talks to the gateway's `/api/payments` surface (payment-service).
 *
 * Backend is a TWO-PHASE simulator:
 *   1. POST /api/payments/create  — body {orderId, paymentMethod}
 *      Validates the order with order-service and persists a PENDING payment.
 *      Returns {paymentId, orderId, status:PENDING, amount, ...}.
 *
 *   2. POST /api/payments/process — body {paymentId, simulateStatus?}
 *      Settles the payment (default 80% SUCCESS / 20% FAILED unless an explicit
 *      simulateStatus is supplied). On settle, payment-service patches the
 *      order's status (SUCCESS -> PAID, FAILED -> FAILED).
 *
 * The frontend's older `PaymentIntent` shape (Stripe-style) is preserved as the
 * surface contract; we synthesise its fields from the backend payment row.
 *
 * `confirm()` calls `/process` with the platform's default simulator behaviour
 * unless `forceSucceed=true`, in which case we send `simulateStatus=SUCCESS`.
 */

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: 'requires_action' | 'requires_confirmation' | 'succeeded' | 'failed';
}

export interface PaymentMethodSummary {
  id: string;
  brand: string;
  last4?: string;
}

interface BackendPayment {
  paymentId: number;
  orderId: number;
  userId: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  amount: number;
  paymentMethod?: string;
  transactionId?: string;
}

const mapPaymentToIntent = (p: BackendPayment): PaymentIntent => ({
  id: String(p.paymentId),
  clientSecret: `simulated_${p.paymentId}`,
  amount: p.amount,
  currency: 'INR',
  status:
    p.status === 'SUCCESS' ? 'succeeded'
    : p.status === 'FAILED' ? 'failed'
    : 'requires_confirmation',
});

export const paymentService = {
  /**
   * Create the backend PENDING payment for a given order.
   * The frontend caller knows the orderId at checkout time; pass it through
   * the second argument. (Old call sites that pass only `orderTotal` keep
   * working with the mock fallback path.)
   */
  createIntent: (orderTotal: number, orderId?: string | number, paymentMethod = 'UPI') =>
    withMockFallback(
      async () => {
        // Fail loudly if we don't have a real numeric orderId. Number() silently
        // converts "ord_MOCK_…" or undefined to NaN; JSON.stringify then writes
        // it as `null` and the backend's @NotNull validator rejects with
        // "orderId is required" — a confusing 400 that hides the real cause
        // (a stale bundle, a mock-fallback order, etc.). Throw an ApiError
        // (non-zero status) so withMockFallback bubbles it to the UI instead
        // of falling back to the mock path.
        const numericOrderId = Number(orderId);
        if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) {
          throw {
            status: 422,
            message:
              'Cannot start payment without a valid order id. ' +
              'Place the order first, then call createIntent with its numeric id.',
            code: 'INVALID_ORDER_ID',
          };
        }
        const payment = await api.post<BackendPayment>('/payments/create', {
          orderId: numericOrderId,
          paymentMethod,
        });
        return mapPaymentToIntent(payment);
      },
      () => createMockPaymentIntent(orderTotal),
    ),

  confirm: (intentId: string, forceSucceed = false) =>
    withMockFallback(
      async () => {
        const body: Record<string, string | number> = { paymentId: Number(intentId) };
        if (forceSucceed) body.simulateStatus = 'SUCCESS';
        const payment = await api.post<BackendPayment>('/payments/process', body);
        return mapPaymentToIntent(payment);
      },
      () => confirmMockPaymentIntent(intentId, forceSucceed),
    ),

  /**
   * Backend has no /payments/methods endpoint — methods are an enum on the
   * payment-service side (UPI, CARD, NETBANKING, WALLET, COD). Return the
   * static list directly (no fallback semantics needed).
   */
  methods: (): Promise<PaymentMethodSummary[]> =>
    Promise.resolve([
      { id: 'pm_upi',          brand: 'upi'        },
      { id: 'pm_card_visa',    brand: 'visa',       last4: '4242' },
      { id: 'pm_card_master',  brand: 'mastercard', last4: '8210' },
      { id: 'pm_netbanking',   brand: 'netbanking' },
      { id: 'pm_wallet',       brand: 'wallet'     },
      { id: 'pm_cod',          brand: 'cod'        },
    ]),
};
