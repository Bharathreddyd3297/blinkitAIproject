package com.blinkit.productservice.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ResourceAlreadyExistsException extends RuntimeException {

    private final String code;
    private final int status;

    public ResourceAlreadyExistsException(String message) {
        super(message);
        this.code = "RESOURCE_ALREADY_EXISTS";
        this.status = HttpStatus.CONFLICT.value();
    }

}
