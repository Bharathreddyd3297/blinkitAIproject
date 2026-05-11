package com.blinkit.paymentservice.exception;

public class OrderServiceException extends RuntimeException {

    public OrderServiceException(String message) {
        super(message);
    }

    public OrderServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
