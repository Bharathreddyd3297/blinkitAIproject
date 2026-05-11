package com.blinkit.paymentservice.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Body sent to {@code PATCH /api/orders/{id}/status} on order-service.
 *
 * <p>The status field is a String (not a payment-service enum) because we need
 * to send order-service's own OrderStatus values — currently {@code PAID} on
 * payment success and {@code FAILED} on payment failure — without coupling to
 * its enum class.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateOrderStatusRequest {
    private String status;
}
