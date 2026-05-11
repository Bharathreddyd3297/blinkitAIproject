package com.blinkit.apigateway.exception;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * Writes a JSON {@link ApiResponse} envelope back to the client and
 * short-circuits the filter chain. Used by the JWT and rate-limit filters
 * when they reject a request before it ever reaches a downstream service.
 *
 * <p>Centralised so every gateway-generated error has the same shape,
 * Content-Type, and timestamp behaviour as the rest of the platform.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GatewayResponseWriter {

    private final ObjectMapper objectMapper;

    public Mono<Void> write(ServerWebExchange exchange,
                            HttpStatus status,
                            String errorCode,
                            String message) {
        var response = exchange.getResponse();
        if (response.isCommitted()) {
            return Mono.empty();
        }

        ApiResponse<Object> body = ApiResponse.failure(status.value(), errorCode, message);
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        DataBufferFactory bufferFactory = response.bufferFactory();
        DataBuffer buffer;
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(body);
            buffer = bufferFactory.wrap(bytes);
        } catch (JsonProcessingException ex) {
            log.error("Failed to serialise error envelope, falling back to plain text", ex);
            buffer = bufferFactory.wrap(message.getBytes(StandardCharsets.UTF_8));
        }
        return response.writeWith(Mono.just(buffer));
    }
}
