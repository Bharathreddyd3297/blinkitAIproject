package com.blinkit.paymentservice.dto.response;

import com.blinkit.paymentservice.entity.PaymentMethod;
import com.blinkit.paymentservice.entity.PaymentStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentResponse {

    private Long paymentId;
    private Long orderId;
    private Long userId;
    private String transactionId;
    private PaymentStatus status;
    private BigDecimal amount;
    private PaymentMethod paymentMethod;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
