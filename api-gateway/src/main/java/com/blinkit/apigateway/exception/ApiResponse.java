package com.blinkit.apigateway.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Gateway-side mirror of the platform-wide {@code ApiResponse<T>} envelope.
 *
 * <p>The downstream services already return this shape; the gateway only ever
 * <i>generates</i> envelopes for errors it produces itself (401, 403, 429,
 * 502, 504). Successful proxied responses are streamed through unchanged.
 *
 * <p>Defined locally rather than imported because the platform has no shared
 * library yet — a future {@code blinkit-platform-commons} module is the right
 * home for it. Keeping the field names + ordering identical is the contract.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;
    private String message;
    private String error;
    private Integer status;
    private T data;

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    public static <T> ApiResponse<T> failure(int status, String error, String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .status(status)
                .error(error)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
