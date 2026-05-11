package com.blinkit.cartservice.service;

import com.blinkit.cartservice.dto.request.AddCartRequest;
import com.blinkit.cartservice.dto.request.UpdateCartRequest;
import com.blinkit.cartservice.dto.response.CartItemResponse;
import com.blinkit.cartservice.dto.response.CartResponse;

public interface CartService {

    CartItemResponse addItemToCart(Long userId, AddCartRequest request);

    CartResponse getCartByUserId(Long userId);

    CartItemResponse updateCartItem(Long userId, Long cartItemId, UpdateCartRequest request);

    void removeCartItem(Long userId, Long cartItemId);

    void clearCart(Long userId);
}
