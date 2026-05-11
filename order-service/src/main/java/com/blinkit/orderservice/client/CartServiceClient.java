package com.blinkit.orderservice.client;

import com.blinkit.orderservice.dto.response.ApiResponse;
import com.blinkit.orderservice.dto.response.CartResponse;
import com.blinkit.orderservice.exception.CartServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * WebClient-backed adapter for cart-service.
 *
 * <p><b>JWT propagation:</b> for every outbound call this client copies the
 * inbound request's {@code Authorization: Bearer ...} header onto the
 * outbound request via {@link #currentAuthorizationHeader()}. cart-service
 * returns the cart owned by the user encoded in that JWT — no userId is
 * passed in the URL, so the token IS the identity.
 *
 * <p>cart-service wraps every body in {@code ApiResponse<T>}; we deserialize
 * with a {@link ParameterizedTypeReference} and unwrap the {@code data} field.
 */
@Slf4j
@Component
public class CartServiceClient {

    private static final String CART_PATH = "/api/cart";
    private static final String CART_CLEAR_PATH = "/api/cart/clear";

    private final WebClient cartServiceWebClient;

    public CartServiceClient(@Qualifier("cartServiceWebClient") WebClient cartServiceWebClient) {
        this.cartServiceWebClient = cartServiceWebClient;
    }

    /**
     * Fetch the authenticated user's cart from cart-service.
     * Returns {@code null} if cart-service responds successfully but with no body / no data.
     */
    public CartResponse getCurrentUserCart() {
        log.debug("Fetching cart from cart-service for current user (JWT-identified)");
        try {
            ApiResponse<CartResponse> envelope = cartServiceWebClient.get()
                    .uri(CART_PATH)
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(this::applyAuthorizationHeader)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Client error")
                                    .flatMap(body -> Mono.error(new CartServiceException(
                                            "Cart service client error: " + body))))
                    .onStatus(status -> status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Server error")
                                    .flatMap(body -> Mono.error(new CartServiceException(
                                            "Cart service server error: " + body))))
                    .bodyToMono(new ParameterizedTypeReference<ApiResponse<CartResponse>>() {})
                    .timeout(Duration.ofSeconds(5))
                    .block();
            return envelope != null ? envelope.getData() : null;
        } catch (CartServiceException ex) {
            throw ex;
        } catch (WebClientRequestException ex) {
            log.error("Failed to reach cart-service when fetching cart", ex);
            throw new CartServiceException(
                    "Unable to reach cart-service: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error calling cart-service for current cart", ex);
            throw new CartServiceException(
                    "Unexpected error calling cart-service: " + ex.getMessage(), ex);
        }
    }

    /**
     * Clear the authenticated user's cart after a successful checkout.
     * <p>This is best-effort: if cart-service is unreachable post-order-creation, the order
     * has already been persisted in this service's DB. Callers should log and continue
     * rather than failing the whole checkout.
     */
    public void clearCurrentUserCart() {
        log.info("Clearing cart in cart-service after successful checkout");
        try {
            cartServiceWebClient.delete()
                    .uri(CART_CLEAR_PATH)
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(this::applyAuthorizationHeader)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Client error")
                                    .flatMap(body -> Mono.error(new CartServiceException(
                                            "Cart service client error on clear: " + body))))
                    .onStatus(status -> status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Server error")
                                    .flatMap(body -> Mono.error(new CartServiceException(
                                            "Cart service server error on clear: " + body))))
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(5))
                    .block();
        } catch (CartServiceException ex) {
            throw ex;
        } catch (WebClientRequestException ex) {
            log.error("Failed to reach cart-service when clearing cart", ex);
            throw new CartServiceException(
                    "Unable to reach cart-service to clear cart: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error calling cart-service to clear cart", ex);
            throw new CartServiceException(
                    "Unexpected error calling cart-service to clear cart: " + ex.getMessage(), ex);
        }
    }

    private void applyAuthorizationHeader(HttpHeaders headers) {
        String authHeader = currentAuthorizationHeader();
        if (authHeader != null) {
            headers.set(HttpHeaders.AUTHORIZATION, authHeader);
        }
    }

    private String currentAuthorizationHeader() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                return attrs.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
            }
        } catch (Exception ex) {
            log.debug("No request context available for forwarding Authorization header");
        }
        return null;
    }
}
