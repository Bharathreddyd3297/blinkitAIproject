package com.blinkit.cartservice.controller;

import com.blinkit.cartservice.dto.request.AddCartRequest;
import com.blinkit.cartservice.dto.request.UpdateCartRequest;
import com.blinkit.cartservice.dto.response.ApiResponse;
import com.blinkit.cartservice.dto.response.CartItemResponse;
import com.blinkit.cartservice.dto.response.CartResponse;
import com.blinkit.cartservice.security.SecurityUtils;
import com.blinkit.cartservice.service.CartService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
@Tag(name = "Cart", description = "Endpoints for managing the authenticated user's cart")
@SecurityRequirement(name = "bearerAuth")
public class CartController {

    private final CartService cartService;

    @PostMapping("/add")
    @Operation(summary = "Add item to cart", description = "Adds a product to the authenticated user's cart")
    public ResponseEntity<ApiResponse<CartItemResponse>> addItemToCart(
            @Valid @RequestBody AddCartRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("POST /api/cart/add userId={} productId={} qty={}",
                userId, request.getProductId(), request.getQuantity());
        CartItemResponse data = cartService.addItemToCart(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Item added to cart successfully", data));
    }

    @GetMapping
    @Operation(summary = "Get cart", description = "Returns the authenticated user's cart with totals")
    public ResponseEntity<ApiResponse<CartResponse>> getCart() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("GET /api/cart userId={}", userId);
        CartResponse data = cartService.getCartByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success("Cart retrieved successfully", data));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update cart item", description = "Updates the quantity of a cart item owned by the user")
    public ResponseEntity<ApiResponse<CartItemResponse>> updateCartItem(
            @PathVariable("id") Long cartItemId,
            @Valid @RequestBody UpdateCartRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("PUT /api/cart/{} userId={} qty={}", cartItemId, userId, request.getQuantity());
        CartItemResponse data = cartService.updateCartItem(userId, cartItemId, request);
        return ResponseEntity.ok(ApiResponse.success("Cart item updated successfully", data));
    }

    @DeleteMapping("/clear")
    @Operation(summary = "Clear cart", description = "Removes all cart items belonging to the authenticated user")
    public ResponseEntity<ApiResponse<Void>> clearCart() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("DELETE /api/cart/clear userId={}", userId);
        cartService.clearCart(userId);
        return ResponseEntity.ok(ApiResponse.success("Cart cleared successfully"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Remove cart item", description = "Removes a specific cart item owned by the user")
    public ResponseEntity<ApiResponse<Void>> removeCartItem(@PathVariable("id") Long cartItemId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("DELETE /api/cart/{} userId={}", cartItemId, userId);
        cartService.removeCartItem(userId, cartItemId);
        return ResponseEntity.ok(ApiResponse.success("Cart item removed successfully"));
    }
}
