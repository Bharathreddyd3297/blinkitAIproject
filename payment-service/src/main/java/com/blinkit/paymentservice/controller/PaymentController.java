package com.blinkit.paymentservice.controller;

import com.blinkit.paymentservice.dto.request.CreatePaymentRequest;
import com.blinkit.paymentservice.dto.request.ProcessPaymentRequest;
import com.blinkit.paymentservice.dto.response.ApiResponse;
import com.blinkit.paymentservice.dto.response.PaymentResponse;
import com.blinkit.paymentservice.security.SecurityUtils;
import com.blinkit.paymentservice.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Endpoints for creating, processing, and inspecting simulated payments")
@SecurityRequirement(name = "bearerAuth")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create")
    @Operation(
            summary = "Create payment request",
            description = "Validates the order with order-service (forwarding the inbound JWT) "
                    + "and persists a PENDING payment record for the authenticated user. "
                    + "Does NOT settle the payment — call /process to simulate settlement."
    )
    public ResponseEntity<ApiResponse<PaymentResponse>> createPayment(
            @Valid @RequestBody CreatePaymentRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("POST /api/payments/create userId={} orderId={} method={}",
                userId, request.getOrderId(), request.getPaymentMethod());
        PaymentResponse data = paymentService.createPayment(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Payment created successfully", data));
    }

    @PostMapping("/process")
    @Operation(
            summary = "Simulate payment processing",
            description = "Drives the simulated payment for a previously-created PENDING payment. "
                    + "If simulateStatus is provided (SUCCESS or FAILED) it is used verbatim; "
                    + "otherwise the service draws an outcome from the configured success-rate "
                    + "distribution (default 80% SUCCESS / 20% FAILED). On settlement, the "
                    + "associated order's status is updated on order-service "
                    + "(SUCCESS -> PAID, FAILED -> FAILED)."
    )
    public ResponseEntity<ApiResponse<PaymentResponse>> processPayment(
            @Valid @RequestBody ProcessPaymentRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("POST /api/payments/process userId={} paymentId={}",
                userId, request.getPaymentId());
        PaymentResponse data = paymentService.processPayment(userId, request);
        String message = data.getStatus() != null && data.getStatus().name().equals("SUCCESS")
                ? "Payment processed successfully"
                : "Payment processing completed";
        return ResponseEntity.ok(ApiResponse.success(message, data));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get payment details", description = "Returns the details of a specific payment owned by the authenticated user")
    public ResponseEntity<ApiResponse<PaymentResponse>> getPayment(@PathVariable("id") Long paymentId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("GET /api/payments/{} userId={}", paymentId, userId);
        PaymentResponse data = paymentService.getPaymentById(userId, paymentId);
        return ResponseEntity.ok(ApiResponse.success("Payment retrieved successfully", data));
    }

    @GetMapping("/history")
    @Operation(summary = "Payment history", description = "Returns the full payment history for the authenticated user, newest first")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getPaymentHistory() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("GET /api/payments/history userId={}", userId);
        List<PaymentResponse> data = paymentService.getPaymentHistory(userId);
        return ResponseEntity.ok(ApiResponse.success("Payment history retrieved successfully", data));
    }
}
