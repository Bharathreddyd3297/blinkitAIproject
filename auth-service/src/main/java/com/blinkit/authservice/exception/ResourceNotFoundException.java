package com.blinkit.authservice.exception;

import lombok.Getter;

@Getter
public class ResourceNotFoundException extends RuntimeException {

    private final String code;
    private final int status;

    public ResourceNotFoundException(String message, String code) {
        super(message);
        this.code = code;
        this.status = 404;
    }
}
