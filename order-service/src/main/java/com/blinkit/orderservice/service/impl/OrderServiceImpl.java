package com.blinkit.orderservice.service.impl;

import com.blinkit.orderservice.client.CartServiceClient;
import com.blinkit.orderservice.client.ProductServiceClient;
import com.blinkit.orderservice.dto.response.CartItemResponse;
import com.blinkit.orderservice.dto.response.CartResponse;
import com.blinkit.orderservice.dto.response.OrderItemResponse;
import com.blinkit.orderservice.dto.response.OrderResponse;
import com.blinkit.orderservice.dto.response.ProductResponse;
import com.blinkit.orderservice.entity.Order;
import com.blinkit.orderservice.entity.OrderItem;
import com.blinkit.orderservice.entity.OrderStatus;
import com.blinkit.orderservice.exception.CartServiceException;
import com.blinkit.orderservice.exception.EmptyCartException;
import com.blinkit.orderservice.exception.InsufficientStockException;
import com.blinkit.orderservice.exception.OrderNotFoundException;
import com.blinkit.orderservice.exception.ProductNotFoundException;
import com.blinkit.orderservice.exception.ProductServiceException;
import com.blinkit.orderservice.exception.UnauthorizedException;
import com.blinkit.orderservice.repository.OrderRepository;
import com.blinkit.orderservice.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Orchestrates the checkout workflow across cart-service and product-service.
 *
 * <p><b>Checkout flow</b> (matches the platform spec):
 * <ol>
 *   <li>Inbound JWT validated by JwtAuthenticationFilter; userId taken from SecurityContext.</li>
 *   <li>Fetch the user's cart from cart-service (JWT propagated downstream).</li>
 *   <li>Reject empty carts.</li>
 *   <li>Re-validate every product still exists and has enough stock via product-service.</li>
 *   <li>Persist the order + items in one DB transaction (status = CREATED).</li>
 *   <li>Best-effort post-commit: reduce inventory for each item, then clear the cart.
 *       Failures are logged but do not roll back the saved order — reconciliation is the
 *       responsibility of the payment / saga layer in a real distributed deployment.</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final CartServiceClient cartServiceClient;
    private final ProductServiceClient productServiceClient;

    @Override
    @Transactional
    public OrderResponse checkout(Long userId) {
        log.info("Starting checkout for userId={}", userId);

        CartResponse cart = cartServiceClient.getCurrentUserCart();
        validateCartNotEmpty(cart);

        List<OrderItem> orderItems = buildAndValidateOrderItems(cart.getItems());
        BigDecimal totalAmount = sumTotal(orderItems);

        Order order = Order.builder()
                .userId(userId)
                .totalAmount(totalAmount)
                .status(OrderStatus.CREATED)
                .build();
        orderItems.forEach(order::addItem);
        Order saved = orderRepository.save(order);
        log.info("Order persisted id={} userId={} totalAmount={} items={}",
                saved.getId(), userId, totalAmount, orderItems.size());

        // --- Post-persist orchestration. Wrapped to never roll back the saved order; ---
        // --- reconciliation is the job of the platform's payment / saga layer.       ---
        reduceInventoryBestEffort(saved);
        clearCartBestEffort();

        return toOrderResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersByUserId(Long userId) {
        log.debug("Fetching orders for userId={}", userId);
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toOrderResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long userId, Long orderId) {
        log.debug("Fetching order id={} for userId={}", orderId, userId);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
        if (!order.getUserId().equals(userId)) {
            log.warn("User {} attempted to access order {} owned by user {}",
                    userId, orderId, order.getUserId());
            throw new UnauthorizedException("You are not allowed to view this order");
        }
        return toOrderResponse(order);
    }

    @Override
    @Transactional
    public OrderResponse updateOrderStatus(Long userId, Long orderId, OrderStatus status) {
        log.info("Updating order id={} status={} requestedBy userId={}", orderId, status, userId);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
        if (!order.getUserId().equals(userId)) {
            log.warn("User {} attempted to mutate order {} owned by user {}",
                    userId, orderId, order.getUserId());
            throw new UnauthorizedException("You are not allowed to modify this order");
        }
        order.setStatus(status);
        Order updated = orderRepository.save(order);
        return toOrderResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> getOrderHistory(Long userId) {
        log.debug("Fetching order history for userId={}", userId);
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toOrderResponse)
                .toList();
    }

    // ---------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------

    private void validateCartNotEmpty(CartResponse cart) {
        if (cart == null || cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new EmptyCartException("Cannot checkout an empty cart");
        }
    }

    /**
     * Re-validates every cart item against the live product catalogue (existence + stock)
     * and snapshots name/price into a fresh OrderItem. We deliberately do NOT trust the
     * cart's price/name fields blindly — they may be stale.
     */
    private List<OrderItem> buildAndValidateOrderItems(List<CartItemResponse> cartItems) {
        List<OrderItem> orderItems = new ArrayList<>(cartItems.size());
        for (CartItemResponse cartItem : cartItems) {
            ProductResponse product = fetchAndValidateProduct(cartItem.getProductId());
            validateStock(product, cartItem.getQuantity());

            BigDecimal unitPrice = product.getPrice() != null
                    ? product.getPrice()
                    : (cartItem.getPrice() != null ? cartItem.getPrice() : BigDecimal.ZERO);
            int quantity = cartItem.getQuantity() != null ? cartItem.getQuantity() : 0;
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));

            OrderItem item = OrderItem.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .quantity(quantity)
                    .price(unitPrice)
                    .totalPrice(lineTotal)
                    .build();
            orderItems.add(item);
        }
        return orderItems;
    }

    private ProductResponse fetchAndValidateProduct(Long productId) {
        ProductResponse product = productServiceClient.getProductById(productId);
        if (product == null || product.getId() == null) {
            throw new ProductNotFoundException(productId);
        }
        return product;
    }

    private void validateStock(ProductResponse product, int requestedQuantity) {
        Integer availableStock = product.getStock();
        if (availableStock == null || availableStock <= 0) {
            throw new InsufficientStockException(
                    "Product '" + product.getName() + "' is out of stock");
        }
        if (availableStock < requestedQuantity) {
            throw new InsufficientStockException(
                    "Insufficient stock for product '" + product.getName() + "'. Available: "
                            + availableStock + ", requested: " + requestedQuantity);
        }
    }

    private BigDecimal sumTotal(List<OrderItem> items) {
        return items.stream()
                .map(OrderItem::getTotalPrice)
                .filter(p -> p != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void reduceInventoryBestEffort(Order order) {
        for (OrderItem item : order.getItems()) {
            try {
                productServiceClient.adjustInventory(
                        item.getProductId(),
                        -item.getQuantity(),
                        "order-service:checkout:order=" + order.getId());
            } catch (ProductNotFoundException | ProductServiceException ex) {
                log.warn("Inventory reduction failed for orderId={} productId={}: {}",
                        order.getId(), item.getProductId(), ex.getMessage());
                // Do not fail the order — reconciliation is handled async by the platform.
            }
        }
    }

    private void clearCartBestEffort() {
        try {
            cartServiceClient.clearCurrentUserCart();
        } catch (CartServiceException ex) {
            log.warn("Cart-clear after checkout failed (order is already saved): {}", ex.getMessage());
        }
    }

    // ---------------------------------------------------------------------------------------
    // Mappers
    // ---------------------------------------------------------------------------------------

    private OrderResponse toOrderResponse(Order order) {
        List<OrderItemResponse> itemResponses = order.getItems() == null
                ? List.of()
                : order.getItems().stream().map(this::toOrderItemResponse).toList();
        return OrderResponse.builder()
                .orderId(order.getId())
                .userId(order.getUserId())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .items(itemResponses)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    private OrderItemResponse toOrderItemResponse(OrderItem item) {
        return OrderItemResponse.builder()
                .id(item.getId())
                .productId(item.getProductId())
                .productName(item.getProductName())
                .quantity(item.getQuantity())
                .price(item.getPrice())
                .totalPrice(item.getTotalPrice())
                .build();
    }
}
