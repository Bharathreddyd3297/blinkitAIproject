package com.blinkit.orderservice.controller;

import com.blinkit.orderservice.dto.request.UpdateOrderStatusRequest;
import com.blinkit.orderservice.dto.response.ApiResponse;
import com.blinkit.orderservice.dto.response.OrderResponse;
import com.blinkit.orderservice.security.SecurityUtils;
import com.blinkit.orderservice.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "Orders", description = "Endpoints for checkout, viewing orders, and updating order status")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/checkout")
    @Operation(
            summary = "Checkout cart",
            description = "Converts the authenticated user's cart into a new order. "
                    + "Validates products and stock against product-service, persists the order, "
                    + "reduces inventory and clears the cart."
    )
    public ResponseEntity<ApiResponse<OrderResponse>> checkout() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("POST /api/orders/checkout userId={}", userId);
        OrderResponse data = orderService.checkout(userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Order created successfully", data));
    }

    @GetMapping
    @Operation(summary = "List orders", description = "Returns the authenticated user's orders, newest first")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getOrders() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("GET /api/orders userId={}", userId);
        List<OrderResponse> data = orderService.getOrdersByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success("Orders retrieved successfully", data));
    }

    @GetMapping("/history")
    @Operation(summary = "Order history", description = "Returns the full order history for the authenticated user, newest first")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getOrderHistory() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("GET /api/orders/history userId={}", userId);
        List<OrderResponse> data = orderService.getOrderHistory(userId);
        return ResponseEntity.ok(ApiResponse.success("Order history retrieved successfully", data));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get order details", description = "Returns the details of a specific order owned by the authenticated user")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrder(@PathVariable("id") Long orderId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("GET /api/orders/{} userId={}", orderId, userId);
        OrderResponse data = orderService.getOrderById(userId, orderId);
        return ResponseEntity.ok(ApiResponse.success("Order retrieved successfully", data));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update order status", description = "Updates the status of an order owned by the authenticated user")
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(
            @PathVariable("id") Long orderId,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("PATCH /api/orders/{}/status userId={} status={}", orderId, userId, request.getStatus());
        OrderResponse data = orderService.updateOrderStatus(userId, orderId, request.getStatus());
        return ResponseEntity.ok(ApiResponse.success("Order status updated successfully", data));
    }
}
