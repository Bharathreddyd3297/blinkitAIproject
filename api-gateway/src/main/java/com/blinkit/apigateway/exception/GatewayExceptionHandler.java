package com.blinkit.apigateway.exception;

import io.netty.channel.ConnectTimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.error.ErrorAttributeOptions;
import org.springframework.boot.web.reactive.error.DefaultErrorAttributes;
import org.springframework.cloud.gateway.support.NotFoundException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerCodecConfigurer;
import org.springframework.web.reactive.function.server.RequestPredicates;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.net.UnknownHostException;
import java.nio.channels.ClosedChannelException;
import java.util.Map;
import java.util.concurrent.TimeoutException;

/**
 * Centralised error envelope for everything that escapes the gateway filter
 * chain — downstream connection failures, route 404s, unmapped exceptions.
 *
 * <p>Produces the same {@link ApiResponse} envelope used by the rest of the
 * platform so the React frontend can parse all errors uniformly regardless
 * of whether they originate at the gateway or at a downstream service.
 *
 * <p>Implemented via a Spring Cloud Gateway-friendly configuration: an
 * {@link DefaultErrorWebExceptionHandler} replacement that sits before the
 * default one (lower order = higher priority).
 */
@Configuration
@Slf4j
public class GatewayExceptionHandler {

    @Bean
    @Order(-2) // before DefaultErrorWebExceptionHandler (-1)
    public org.springframework.boot.autoconfigure.web.reactive.error.AbstractErrorWebExceptionHandler
    errorWebExceptionHandler(
            DefaultErrorAttributes errorAttributes,
            org.springframework.boot.autoconfigure.web.WebProperties webProperties,
            org.springframework.context.ApplicationContext applicationContext,
            ServerCodecConfigurer codecConfigurer) {

        var handler = new JsonErrorWebExceptionHandler(
                errorAttributes,
                webProperties.getResources(),
                applicationContext);
        handler.setMessageWriters(codecConfigurer.getWriters());
        handler.setMessageReaders(codecConfigurer.getReaders());
        return handler;
    }

    /**
     * Custom error handler that emits the platform's {@code ApiResponse}
     * envelope instead of Spring's default JSON shape.
     */
    static class JsonErrorWebExceptionHandler
            extends org.springframework.boot.autoconfigure.web.reactive.error.AbstractErrorWebExceptionHandler {

        JsonErrorWebExceptionHandler(DefaultErrorAttributes errorAttributes,
                                     org.springframework.boot.autoconfigure.web.WebProperties.Resources resources,
                                     org.springframework.context.ApplicationContext applicationContext) {
            super(errorAttributes, resources, applicationContext);
        }

        @Override
        protected RouterFunction<ServerResponse> getRoutingFunction(
                org.springframework.boot.web.reactive.error.ErrorAttributes errorAttributes) {
            return RouterFunctions.route(RequestPredicates.all(), this::renderErrorResponse);
        }

        private Mono<ServerResponse> renderErrorResponse(
                org.springframework.web.reactive.function.server.ServerRequest request) {

            Map<String, Object> attributes = getErrorAttributes(
                    request, ErrorAttributeOptions.defaults());
            Throwable error = getError(request);

            HttpStatus status = mapStatus(error, attributes);
            String code = mapErrorCode(error, status);
            String message = mapMessage(error, status);

            if (status.is5xxServerError()) {
                log.error("Gateway error code={} status={} path={} cause={}",
                        code, status.value(), request.path(),
                        error == null ? "n/a" : error.toString());
            } else {
                log.warn("Gateway error code={} status={} path={}",
                        code, status.value(), request.path());
            }

            ApiResponse<Object> body = ApiResponse.failure(status.value(), code, message);
            return ServerResponse.status(status)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body);
        }

        private static HttpStatus mapStatus(Throwable error, Map<String, Object> attributes) {
            if (error instanceof ResponseStatusException rse) {
                HttpStatus s = HttpStatus.resolve(rse.getStatusCode().value());
                return s != null ? s : HttpStatus.INTERNAL_SERVER_ERROR;
            }
            if (error instanceof NotFoundException) {
                return HttpStatus.NOT_FOUND;
            }
            if (isDownstreamUnavailable(error)) {
                return HttpStatus.SERVICE_UNAVAILABLE;
            }
            if (error instanceof TimeoutException) {
                return HttpStatus.GATEWAY_TIMEOUT;
            }
            Object code = attributes.get("status");
            if (code instanceof Integer i) {
                HttpStatus s = HttpStatus.resolve(i);
                if (s != null) return s;
            }
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }

        private static String mapErrorCode(Throwable error, HttpStatus status) {
            if (error instanceof NotFoundException) {
                return "ROUTE_NOT_FOUND";
            }
            if (isDownstreamUnavailable(error)) {
                return "SERVICE_UNAVAILABLE";
            }
            if (error instanceof TimeoutException) {
                return "GATEWAY_TIMEOUT";
            }
            return switch (status) {
                case BAD_REQUEST -> "BAD_REQUEST";
                case UNAUTHORIZED -> "UNAUTHORIZED";
                case FORBIDDEN -> "FORBIDDEN";
                case NOT_FOUND -> "NOT_FOUND";
                case TOO_MANY_REQUESTS -> "RATE_LIMIT_EXCEEDED";
                case BAD_GATEWAY -> "BAD_GATEWAY";
                case SERVICE_UNAVAILABLE -> "SERVICE_UNAVAILABLE";
                case GATEWAY_TIMEOUT -> "GATEWAY_TIMEOUT";
                default -> "INTERNAL_SERVER_ERROR";
            };
        }

        private static String mapMessage(Throwable error, HttpStatus status) {
            if (error instanceof NotFoundException) {
                return "No route configured for the requested path";
            }
            if (isDownstreamUnavailable(error)) {
                return "Downstream service is currently unavailable";
            }
            if (error instanceof TimeoutException) {
                return "Downstream service timed out";
            }
            if (error instanceof ResponseStatusException rse && rse.getReason() != null) {
                return rse.getReason();
            }
            return status.getReasonPhrase();
        }

        private static boolean isDownstreamUnavailable(Throwable error) {
            Throwable t = error;
            while (t != null) {
                if (t instanceof java.net.ConnectException
                        || t instanceof UnknownHostException
                        || t instanceof ConnectTimeoutException
                        || t instanceof ClosedChannelException) {
                    return true;
                }
                if (t instanceof IOException
                        && t.getMessage() != null
                        && t.getMessage().toLowerCase().contains("connection")) {
                    return true;
                }
                t = t.getCause();
            }
            return false;
        }
    }
}
