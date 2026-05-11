package com.blinkit.paymentservice.dto.request;

import com.blinkit.paymentservice.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePaymentRequest {

    @NotNull(message = "orderId is required")
    @Positive(message = "orderId must be positive")
    private Long orderId;

    @NotNull(message = "paymentMethod is required (UPI, CARD, NETBANKING, WALLET, COD)")
    private PaymentMethod paymentMethod;
}
