package com.blinkit.productservice.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class InsufficientStockException extends RuntimeException {

    private final String code;
    private final int status;

    public InsufficientStockException(String message) {
        super(message);
        this.code = "INSUFFICIENT_STOCK";
        this.status = HttpStatus.CONFLICT.value();
    }

}
