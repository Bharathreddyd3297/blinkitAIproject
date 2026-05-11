package com.blinkit.cartservice.exception;

public class CartItemNotFoundException extends RuntimeException {

    public CartItemNotFoundException(String message) {
        super(message);
    }

    public CartItemNotFoundException(Long id) {
        super("Cart item not found with id: " + id);
    }
}
