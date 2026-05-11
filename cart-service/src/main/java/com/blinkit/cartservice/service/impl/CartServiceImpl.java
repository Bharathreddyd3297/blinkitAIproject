package com.blinkit.cartservice.service.impl;

import com.blinkit.cartservice.client.ProductServiceClient;
import com.blinkit.cartservice.dto.request.AddCartRequest;
import com.blinkit.cartservice.dto.request.UpdateCartRequest;
import com.blinkit.cartservice.dto.response.CartItemResponse;
import com.blinkit.cartservice.dto.response.CartResponse;
import com.blinkit.cartservice.dto.response.ProductResponse;
import com.blinkit.cartservice.entity.CartItem;
import com.blinkit.cartservice.exception.CartItemNotFoundException;
import com.blinkit.cartservice.exception.InsufficientStockException;
import com.blinkit.cartservice.exception.ProductNotFoundException;
import com.blinkit.cartservice.exception.UnauthorizedException;
import com.blinkit.cartservice.repository.CartItemRepository;
import com.blinkit.cartservice.service.CartService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private final CartItemRepository cartItemRepository;
    private final ProductServiceClient productServiceClient;

    @Override
    @Transactional
    public CartItemResponse addItemToCart(Long userId, AddCartRequest request) {
        log.info("Adding product {} (qty {}) to cart for userId={}",
                request.getProductId(), request.getQuantity(), userId);

        ProductResponse product = fetchAndValidateProduct(request.getProductId());

        Optional<CartItem> existingOpt =
                cartItemRepository.findByUserIdAndProductId(userId, request.getProductId());

        int desiredQuantity = existingOpt
                .map(existing -> existing.getQuantity() + request.getQuantity())
                .orElse(request.getQuantity());

        validateStock(product, desiredQuantity);

        BigDecimal unitPrice = product.getPrice() != null ? product.getPrice() : BigDecimal.ZERO;

        CartItem cartItem = existingOpt
                .map(existing -> {
                    existing.setQuantity(desiredQuantity);
                    existing.setPrice(unitPrice);
                    existing.setProductName(product.getName());
                    existing.setTotalPrice(unitPrice.multiply(BigDecimal.valueOf(desiredQuantity)));
                    return existing;
                })
                .orElseGet(() -> CartItem.builder()
                        .userId(userId)
                        .productId(product.getId())
                        .productName(product.getName())
                        .quantity(request.getQuantity())
                        .price(unitPrice)
                        .totalPrice(unitPrice.multiply(BigDecimal.valueOf(request.getQuantity())))
                        .build());

        CartItem saved = cartItemRepository.save(cartItem);
        log.info("Cart item saved id={} userId={} productId={}",
                saved.getId(), saved.getUserId(), saved.getProductId());
        return toCartItemResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public CartResponse getCartByUserId(Long userId) {
        log.debug("Fetching cart for userId={}", userId);
        List<CartItem> items = cartItemRepository.findByUserId(userId);

        List<CartItemResponse> itemResponses = items.stream()
                .map(this::toCartItemResponse)
                .toList();

        BigDecimal totalAmount = itemResponses.stream()
                .map(CartItemResponse::getTotalPrice)
                .filter(price -> price != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CartResponse.builder()
                .userId(userId)
                .items(itemResponses)
                .totalItems(itemResponses.size())
                .totalAmount(totalAmount)
                .build();
    }

    @Override
    @Transactional
    public CartItemResponse updateCartItem(Long userId, Long cartItemId, UpdateCartRequest request) {
        log.info("Updating cart item id={} for userId={} to quantity={}",
                cartItemId, userId, request.getQuantity());

        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new CartItemNotFoundException(cartItemId));

        if (!cartItem.getUserId().equals(userId)) {
            log.warn("User {} attempted to update cart item {} owned by user {}",
                    userId, cartItemId, cartItem.getUserId());
            throw new UnauthorizedException("You are not allowed to modify this cart item");
        }

        ProductResponse product = fetchAndValidateProduct(cartItem.getProductId());
        validateStock(product, request.getQuantity());

        BigDecimal unitPrice = product.getPrice() != null ? product.getPrice() : cartItem.getPrice();
        cartItem.setQuantity(request.getQuantity());
        cartItem.setPrice(unitPrice);
        cartItem.setProductName(product.getName());
        cartItem.setTotalPrice(unitPrice.multiply(BigDecimal.valueOf(request.getQuantity())));

        CartItem updated = cartItemRepository.save(cartItem);
        return toCartItemResponse(updated);
    }

    @Override
    @Transactional
    public void removeCartItem(Long userId, Long cartItemId) {
        log.info("Removing cart item id={} for userId={}", cartItemId, userId);
        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new CartItemNotFoundException(cartItemId));
        if (!cartItem.getUserId().equals(userId)) {
            log.warn("User {} attempted to delete cart item {} owned by user {}",
                    userId, cartItemId, cartItem.getUserId());
            throw new UnauthorizedException("You are not allowed to modify this cart item");
        }
        cartItemRepository.delete(cartItem);
    }

    @Override
    @Transactional
    public void clearCart(Long userId) {
        log.info("Clearing cart for userId={}", userId);
        cartItemRepository.deleteAllByUserId(userId);
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

    private CartItemResponse toCartItemResponse(CartItem item) {
        return CartItemResponse.builder()
                .id(item.getId())
                .productId(item.getProductId())
                .productName(item.getProductName())
                .quantity(item.getQuantity())
                .price(item.getPrice())
                .totalPrice(item.getTotalPrice())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }
}
