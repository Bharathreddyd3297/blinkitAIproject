package com.blinkit.paymentservice.dto.request;

import com.blinkit.paymentservice.entity.PaymentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Drives the simulated payment-processing call.
 *
 * <p>{@code paymentId} identifies which previously-created payment record to
 * process. {@code simulateStatus} is optional — when present it forces a
 * deterministic outcome (must be SUCCESS or FAILED), and when absent the
 * service falls back to its automatic 80/20 SUCCESS/FAILED simulation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessPaymentRequest {

    @NotNull(message = "paymentId is required")
    @Positive(message = "paymentId must be positive")
    private Long paymentId;

    /**
     * Optional deterministic outcome for the simulated payment. When set, must be
     * SUCCESS or FAILED — any other value is rejected by the service. When null,
     * the service draws an outcome from the configured success-rate distribution.
     */
    private PaymentStatus simulateStatus;
}
