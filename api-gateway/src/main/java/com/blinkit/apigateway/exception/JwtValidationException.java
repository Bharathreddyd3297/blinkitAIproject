package com.blinkit.apigateway.exception;

import lombok.Getter;

/**
 * Thrown by {@link com.blinkit.apigateway.security.JwtTokenValidator} when an
 * inbound token fails verification. The {@code errorCode} is one of
 * {@code MISSING_TOKEN}, {@code TOKEN_EXPIRED}, {@code INVALID_TOKEN} and
 * propagates into the {@code error} field of the JSON envelope returned to
 * the caller.
 */
@Getter
public class JwtValidationException extends RuntimeException {

    private final String errorCode;

    public JwtValidationException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
