import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Container } from '@components/primitives/Container';
import { CheckoutStepper } from '@components/checkout/CheckoutStepper';
import { CheckoutSummary } from '@components/checkout/CheckoutSummary';
import { CartReviewStep } from '@components/checkout/steps/CartReviewStep';
import { ShippingStep } from '@components/checkout/steps/ShippingStep';
import { DeliveryStep } from '@components/checkout/steps/DeliveryStep';
import { PaymentStep } from '@components/checkout/steps/PaymentStep';
import { ConfirmationStep } from '@components/checkout/steps/ConfirmationStep';
import { PaymentProcessingOverlay } from '@components/checkout/PaymentProcessingOverlay';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  DELIVERY_OPTIONS,
  nextStep,
  prevStep,
  processAndPlace,
  resetPaymentStatus,
  setStep,
} from '@store/slices/checkoutSlice';
import { useToast } from '@hooks/useToast';
import { paths } from '@routes/paths';

/**
 * Multi-step checkout orchestrator.
 *
 * Strategy: keep the URL stable at `/checkout`. The current step lives in
 * the slice; <AnimatePresence> handles the cinematic transition between
 * step components. We don't push history per step on purpose — back-button
 * "back through the steps" is a worse UX than back-button "back to cart".
 *
 * Guard rails:
 *   - If the cart is empty (and we're not on the confirmation), bounce to
 *     /products. There's nothing to check out.
 *   - If the user lands here mid-payment-processing and reloads, we reset
 *     the payment status to idle so they don't see a frozen overlay.
 */
export default function CheckoutPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast    = useToast();

  const step          = useAppSelector((s) => s.checkout.step);
  const address       = useAppSelector((s) => s.checkout.address);
  const delivery      = useAppSelector((s) => s.checkout.delivery);
  const paymentMethod = useAppSelector((s) => s.checkout.paymentMethod);
  const paymentStatus = useAppSelector((s) => s.checkout.paymentStatus);
  const paymentError  = useAppSelector((s) => s.checkout.paymentError);
  const cart          = useAppSelector((s) => s.cart.cart);

  // If a previous session crashed mid-payment, clear the overlay on entry.
  useEffect(() => {
    if (paymentStatus === 'processing') dispatch(resetPaymentStatus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empty-cart guard — only when not on the confirmation (which intentionally
  // empties the cart immediately after success).
  useEffect(() => {
    if (step !== 'confirmation' && (!cart || cart.items.length === 0)) {
      // Don't redirect on the very first paint while cart is loading.
      if (cart && cart.items.length === 0) navigate(paths.products, { replace: true });
    }
  }, [cart, step, navigate]);

  const onPay = () => {
    if (!cart) return;
    const opt = DELIVERY_OPTIONS.find((d) => d.speed === delivery)!;
    void dispatch(
      processAndPlace({
        payload: {
          items: cart.items,
          total: cart.total,
          paymentMethodId: paymentMethod,
          paymentIntentId: '', // filled in by the thunk after the intent succeeds
          shippingAddress: address,
          delivery: { speed: delivery, etaMinutes: opt.etaMinutes },
        },
      }),
    ).then((res) => {
      if (res.meta.requestStatus === 'fulfilled') {
        toast.success('Order placed', 'Tracking is live');
      }
    });
  };

  const retryPayment = () => {
    dispatch(resetPaymentStatus());
    // Force the next attempt to succeed so a real demo doesn't loop on randomness.
    if (!cart) return;
    const opt = DELIVERY_OPTIONS.find((d) => d.speed === delivery)!;
    void dispatch(
      processAndPlace({
        forceSucceed: true,
        payload: {
          items: cart.items,
          total: cart.total,
          paymentMethodId: paymentMethod,
          paymentIntentId: '',
          shippingAddress: address,
          delivery: { speed: delivery, etaMinutes: opt.etaMinutes },
        },
      }),
    );
  };

  const cancelFailedPayment = () => {
    dispatch(resetPaymentStatus());
  };

  const isConfirmation = step === 'confirmation';

  return (
    <div>
      <Container className="pt-10 md:pt-14">
        {/* Stepper */}
        <div className="mb-10">
          <CheckoutStepper current={step} />
        </div>

        {/* Step + summary layout (summary hidden on the celebration screen) */}
        <div className={isConfirmation ? '' : 'grid gap-8 lg:grid-cols-[1.7fr_1fr]'}>
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {step === 'review' && (
                <CartReviewStep key="review" onNext={() => dispatch(nextStep())} />
              )}
              {step === 'shipping' && (
                <ShippingStep
                  key="shipping"
                  onBack={() => dispatch(prevStep())}
                  onNext={() => dispatch(nextStep())}
                />
              )}
              {step === 'delivery' && (
                <DeliveryStep
                  key="delivery"
                  onBack={() => dispatch(prevStep())}
                  onNext={() => dispatch(nextStep())}
                />
              )}
              {step === 'payment' && (
                <PaymentStep
                  key="payment"
                  onBack={() => dispatch(prevStep())}
                  onPay={onPay}
                  loading={paymentStatus === 'processing'}
                />
              )}
              {step === 'confirmation' && <ConfirmationStep key="confirmation" />}
            </AnimatePresence>
          </div>

          {!isConfirmation && (
            <aside className="min-w-0">
              <CheckoutSummary />
            </aside>
          )}
        </div>

        {/* Quick step-jump for power users (debug-friendly during demos) */}
        {!isConfirmation && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-[0.7rem] text-ink-300">
            <span>Jump to:</span>
            {(['review', 'shipping', 'delivery', 'payment'] as const).map((s) => (
              <button
                key={s}
                onClick={() => dispatch(setStep(s))}
                className="rounded-full border border-white/10 px-2.5 py-1 capitalize transition hover:border-white/25 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </Container>

      <PaymentProcessingOverlay
        status={paymentStatus}
        errorMessage={paymentError}
        onRetry={retryPayment}
        onCancel={cancelFailedPayment}
      />
    </div>
  );
}
