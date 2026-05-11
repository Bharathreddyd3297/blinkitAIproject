package com.blinkit.productservice.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ResourceNotFoundException extends RuntimeException {

    private final String code;
    private final int status;

    public ResourceNotFoundException(String message) {
        super(message);
        this.code = "RESOURCE_NOT_FOUND";
        this.status = HttpStatus.NOT_FOUND.value();
    }

    public ResourceNotFoundException(String resource, Object identifier) {
        super(String.format("%s not found with identifier: %s", resource, identifier));
        this.code = "RESOURCE_NOT_FOUND";
        this.status = HttpStatus.NOT_FOUND.value();
    }

}
