package com.blinkit.paymentservice.service.impl;

import com.blinkit.paymentservice.client.OrderServiceClient;
import com.blinkit.paymentservice.dto.request.CreatePaymentRequest;
import com.blinkit.paymentservice.dto.request.ProcessPaymentRequest;
import com.blinkit.paymentservice.dto.response.OrderResponse;
import com.blinkit.paymentservice.dto.response.PaymentResponse;
import com.blinkit.paymentservice.entity.Payment;
import com.blinkit.paymentservice.entity.PaymentMethod;
import com.blinkit.paymentservice.entity.PaymentStatus;
import com.blinkit.paymentservice.exception.InvalidOrderException;
import com.blinkit.paymentservice.exception.OrderNotFoundException;
import com.blinkit.paymentservice.exception.OrderServiceException;
import com.blinkit.paymentservice.exception.PaymentNotFoundException;
import com.blinkit.paymentservice.exception.UnauthorizedException;
import com.blinkit.paymentservice.repository.PaymentRepository;
import com.blinkit.paymentservice.service.PaymentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Orchestrates the simulated payment workflow against order-service.
 *
 * <p><b>Lifecycle</b>:
 * <ol>
 *   <li><b>create</b> — caller posts an orderId + payment method.
 *       payment-service validates the order via order-service (forwarding the
 *       inbound JWT) and persists a {@code PENDING} Payment row.</li>
 *   <li><b>process</b> — caller posts the paymentId, optionally with a
 *       deterministic {@code simulateStatus}. The service draws an outcome
 *       from either the explicit override or the configured success-rate
 *       distribution, generates a transactionId, and persists the new status.
 *       It then PATCHes order-service: SUCCESS -> PAID, FAILED -> FAILED.</li>
 *   <li><b>get / history</b> — read-only, scoped to the authenticated user.</li>
 * </ol>
 *
 * <p>This is a TEST APPLICATION — there is no real Razorpay/Stripe SDK; the
 * "payment processor" is the {@link #pickAutomaticOutcome()} method. The
 * lifecycle, JWT propagation, and order-status orchestration ARE production-grade.
 */
@Slf4j
@Service
public class PaymentServiceImpl implements PaymentService {

    private static final DateTimeFormatter TXN_TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final PaymentRepository paymentRepository;
    private final OrderServiceClient orderServiceClient;
    private final int successRatePercent;
    private final SecureRandom random = new SecureRandom();

    public PaymentServiceImpl(
            PaymentRepository paymentRepository,
            OrderServiceClient orderServiceClient,
            @Value("${app.payment.success-rate-percent:80}") int successRatePercent
    ) {
        this.paymentRepository = paymentRepository;
        this.orderServiceClient = orderServiceClient;
        this.successRatePercent = clampPercent(successRatePercent);
    }

    @Override
    @Transactional
    public PaymentResponse createPayment(Long userId, CreatePaymentRequest request) {
        log.info("Creating payment for userId={} orderId={} method={}",
                userId, request.getOrderId(), request.getPaymentMethod());

        OrderResponse order = fetchAndValidateOrder(userId, request.getOrderId());

        Payment payment = Payment.builder()
                .orderId(order.getOrderId())
                .userId(userId)
                .amount(order.getTotalAmount())
                .status(PaymentStatus.PENDING)
                .paymentMethod(request.getPaymentMethod())
                .build();

        Payment saved = paymentRepository.save(payment);
        log.info("Payment created id={} orderId={} userId={} amount={} status=PENDING",
                saved.getId(), saved.getOrderId(), saved.getUserId(), saved.getAmount());
        return toResponse(saved);
    }

    @Override
    @Transactional
    public PaymentResponse processPayment(Long userId, ProcessPaymentRequest request) {
        log.info("Processing payment id={} userId={} simulateStatus={}",
                request.getPaymentId(), userId, request.getSimulateStatus());

        Payment payment = paymentRepository.findById(request.getPaymentId())
                .orElseThrow(() -> new PaymentNotFoundException(request.getPaymentId()));

        if (!payment.getUserId().equals(userId)) {
            log.warn("User {} attempted to process payment {} owned by user {}",
                    userId, payment.getId(), payment.getUserId());
            throw new UnauthorizedException("You are not allowed to process this payment");
        }

        if (payment.getStatus() != PaymentStatus.PENDING) {
            // Reject attempts to re-process a payment that has already settled (SUCCESS/FAILED/REFUNDED).
            // This keeps the lifecycle linear and prevents double-side-effects on order-service.
            throw new InvalidOrderException(
                    "Payment id=" + payment.getId() + " is already in status "
                            + payment.getStatus() + " and cannot be reprocessed");
        }

        // COD is settled offline by the courier on delivery — payment-service marks it
        // SUCCESS immediately at the create-payment step's downstream view, but we still
        // accept the explicit/automatic flow here for symmetry. Real platforms would
        // skip the gateway call entirely for COD; the simulation just runs the same path.

        PaymentStatus outcome = determineOutcome(request.getSimulateStatus(), payment.getPaymentMethod());
        String transactionId = generateTransactionId();

        payment.setStatus(outcome);
        payment.setTransactionId(transactionId);
        Payment updated = paymentRepository.save(payment);
        log.info("Payment id={} settled status={} transactionId={}",
                updated.getId(), outcome, transactionId);

        // Distributed orchestration: tell order-service the new state. Failures here are
        // logged but do NOT roll back the payment — the platform's reconciliation layer is
        // expected to re-drive the order update from this service's persisted state.
        propagateOrderStatusBestEffort(updated);

        return toResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getPaymentById(Long userId, Long paymentId) {
        log.debug("Fetching payment id={} for userId={}", paymentId, userId);
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(paymentId));
        if (!payment.getUserId().equals(userId)) {
            log.warn("User {} attempted to access payment {} owned by user {}",
                    userId, paymentId, payment.getUserId());
            throw new UnauthorizedException("You are not allowed to view this payment");
        }
        return toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getPaymentHistory(Long userId) {
        log.debug("Fetching payment history for userId={}", userId);
        return paymentRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    // ---------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------

    private OrderResponse fetchAndValidateOrder(Long userId, Long orderId) {
        OrderResponse order;
        try {
            order = orderServiceClient.getOrderById(orderId);
        } catch (OrderNotFoundException ex) {
            throw ex;
        } catch (OrderServiceException ex) {
            throw ex;
        }
        if (order == null || order.getOrderId() == null) {
            throw new OrderNotFoundException(orderId);
        }
        if (order.getUserId() != null && !order.getUserId().equals(userId)) {
            // order-service should already enforce this, but defence in depth: do not let a
            // user create a payment record for an order that is not theirs even if
            // order-service ever loosens its check.
            throw new UnauthorizedException("Order " + orderId + " does not belong to the authenticated user");
        }
        if (order.getTotalAmount() == null || order.getTotalAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidOrderException("Order " + orderId + " has an invalid total amount");
        }
        return order;
    }

    private PaymentStatus determineOutcome(PaymentStatus simulateStatus, PaymentMethod method) {
        if (simulateStatus != null) {
            if (simulateStatus != PaymentStatus.SUCCESS && simulateStatus != PaymentStatus.FAILED) {
                throw new IllegalArgumentException(
                        "simulateStatus must be SUCCESS or FAILED, got: " + simulateStatus);
            }
            return simulateStatus;
        }
        // COD always succeeds from the gateway's POV — money is collected on delivery.
        if (method == PaymentMethod.COD) {
            return PaymentStatus.SUCCESS;
        }
        return pickAutomaticOutcome();
    }

    private PaymentStatus pickAutomaticOutcome() {
        int draw = random.nextInt(100);
        return draw < successRatePercent ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
    }

    private String generateTransactionId() {
        String stamp = LocalDateTime.now().format(TXN_TIMESTAMP_FORMAT);
        int suffix = 100000 + random.nextInt(900000);
        return "TXN-" + stamp + "-" + suffix;
    }

    private void propagateOrderStatusBestEffort(Payment payment) {
        String targetOrderStatus = switch (payment.getStatus()) {
            case SUCCESS -> "PAID";
            case FAILED -> "FAILED";
            default -> null;
        };
        if (targetOrderStatus == null) {
            return;
        }
        try {
            orderServiceClient.updateOrderStatus(payment.getOrderId(), targetOrderStatus);
            log.info("Order id={} status updated to {} after payment id={} {}",
                    payment.getOrderId(), targetOrderStatus, payment.getId(), payment.getStatus());
        } catch (OrderNotFoundException | OrderServiceException ex) {
            log.warn("Could not propagate status {} to order id={} for payment id={}: {}",
                    targetOrderStatus, payment.getOrderId(), payment.getId(), ex.getMessage());
            // intentionally swallowed — payment row already persisted with correct status
        }
    }

    private PaymentResponse toResponse(Payment payment) {
        return PaymentResponse.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .userId(payment.getUserId())
                .transactionId(payment.getTransactionId())
                .status(payment.getStatus())
                .amount(payment.getAmount())
                .paymentMethod(payment.getPaymentMethod())
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .build();
    }

    private static int clampPercent(int p) {
        if (p < 0) return 0;
        if (p > 100) return 100;
        return p;
    }
}
