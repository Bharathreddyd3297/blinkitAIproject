package com.blinkit.paymentservice.service;

import com.blinkit.paymentservice.dto.request.CreatePaymentRequest;
import com.blinkit.paymentservice.dto.request.ProcessPaymentRequest;
import com.blinkit.paymentservice.dto.response.PaymentResponse;

import java.util.List;

public interface PaymentService {

    PaymentResponse createPayment(Long userId, CreatePaymentRequest request);

    PaymentResponse processPayment(Long userId, ProcessPaymentRequest request);

    PaymentResponse getPaymentById(Long userId, Long paymentId);

    List<PaymentResponse> getPaymentHistory(Long userId);
}
