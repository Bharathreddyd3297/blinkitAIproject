package com.blinkit.orderservice.service;

import com.blinkit.orderservice.dto.response.OrderResponse;
import com.blinkit.orderservice.entity.OrderStatus;

import java.util.List;

public interface OrderService {

    OrderResponse checkout(Long userId);

    List<OrderResponse> getOrdersByUserId(Long userId);

    OrderResponse getOrderById(Long userId, Long orderId);

    OrderResponse updateOrderStatus(Long userId, Long orderId, OrderStatus status);

    List<OrderResponse> getOrderHistory(Long userId);
}
