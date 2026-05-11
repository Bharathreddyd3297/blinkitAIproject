package com.blinkit.authservice.exception;

import lombok.Getter;

@Getter
public class ResourceAlreadyExistsException extends RuntimeException {

    private final String code;
    private final int status;

    public ResourceAlreadyExistsException(String message, String code) {
        super(message);
        this.code = code;
        this.status = 409;
    }
}
