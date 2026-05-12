package com.blinkit.orderservice.client;

import com.blinkit.orderservice.dto.response.ApiResponse;
import com.blinkit.orderservice.dto.response.ProductResponse;
import com.blinkit.orderservice.exception.ProductNotFoundException;
import com.blinkit.orderservice.exception.ProductServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

/**
 * WebClient-backed adapter for product-service.
 *
 * <p><b>JWT propagation:</b> for every outbound call this client copies the
 * inbound request's {@code Authorization: Bearer ...} header onto the
 * outbound request. product-service validates that token with the SAME
 * shared {@code JWT_SECRET} order-service uses, so the original end-user's
 * identity flows through unchanged.
 *
 * <p>Exposes:
 * <ul>
 *   <li>{@link #getProductById(Long)} — used to validate product existence and stock.</li>
 *   <li>{@link #adjustInventory(Long, int, String)} — best-effort post-checkout inventory reduction.</li>
 * </ul>
 */
@Slf4j
@Component
public class ProductServiceClient {

    private static final String PRODUCT_BY_ID_PATH = "/api/products/{id}";
    private static final String INVENTORY_PATH = "/api/products/{id}/inventory";

    private final WebClient productServiceWebClient;

    /**
     * Long-lived internal SERVICE-role JWT signed with the platform's shared HS512
     * secret. Used for service-to-service mutations (e.g. inventory PATCH) that
     * the inbound USER-role JWT cannot authorise. Empty in dev when no token is
     * configured — in that case the user's token is forwarded as a fallback and
     * the call may 403 (logged + best-effort, does not break checkout).
     */
    @Value("${app.internal.service-jwt:${INTERNAL_SERVICE_JWT:}}")
    private String internalServiceJwt;

    public ProductServiceClient(@Qualifier("productServiceWebClient") WebClient productServiceWebClient) {
        this.productServiceWebClient = productServiceWebClient;
    }

    public ProductResponse getProductById(Long productId) {
        log.debug("Fetching product details for productId={}", productId);
        try {
            ApiResponse<ProductResponse> envelope = productServiceWebClient.get()
                    .uri(PRODUCT_BY_ID_PATH, productId)
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(this::applyAuthorizationHeader)
                    .retrieve()
                    .onStatus(status -> status.value() == HttpStatus.NOT_FOUND.value(),
                            response -> Mono.error(new ProductNotFoundException(productId)))
                    .onStatus(status -> status.is4xxClientError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Client error")
                                    .flatMap(body -> Mono.error(new ProductServiceException(
                                            "Product service client error: " + body))))
                    .onStatus(status -> status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Server error")
                                    .flatMap(body -> Mono.error(new ProductServiceException(
                                            "Product service server error: " + body))))
                    .bodyToMono(new ParameterizedTypeReference<ApiResponse<ProductResponse>>() {})
                    .timeout(Duration.ofSeconds(10))
                    .block();
            return envelope != null ? envelope.getData() : null;
        } catch (ProductNotFoundException | ProductServiceException ex) {
            throw ex;
        } catch (WebClientResponseException.NotFound ex) {
            throw new ProductNotFoundException(productId);
        } catch (WebClientRequestException ex) {
            log.error("Failed to reach product-service for productId={}", productId, ex);
            throw new ProductServiceException(
                    "Unable to reach product-service: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error calling product-service for productId={}", productId, ex);
            throw new ProductServiceException(
                    "Unexpected error calling product-service: " + ex.getMessage(), ex);
        }
    }

    /**
     * Adjust inventory by {@code delta} (negative to reduce, positive to restock).
     *
     * <p>Calls {@code PATCH /api/products/{id}/inventory} on product-service. The end-user's
     * JWT is forwarded; if product-service requires elevated privileges to mutate inventory,
     * the call may be rejected with 403. The caller must decide whether to fail the whole
     * checkout or treat this as a recoverable error and reconcile asynchronously.
     */
    public void adjustInventory(Long productId, int delta, String reason) {
        log.info("Adjusting inventory for productId={} delta={} reason={}", productId, delta, reason);
        try {
            productServiceWebClient.patch()
                    .uri(INVENTORY_PATH, productId)
                    .accept(MediaType.APPLICATION_JSON)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(this::applyServiceAuthorizationHeader)
                    .bodyValue(Map.of(
                            "delta", delta,
                            "reason", reason != null ? reason : "order-service:checkout"
                    ))
                    .retrieve()
                    .onStatus(status -> status.value() == HttpStatus.NOT_FOUND.value(),
                            response -> Mono.error(new ProductNotFoundException(productId)))
                    .onStatus(status -> status.is4xxClientError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Client error")
                                    .flatMap(body -> Mono.error(new ProductServiceException(
                                            "Inventory adjust client error: " + body))))
                    .onStatus(status -> status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Server error")
                                    .flatMap(body -> Mono.error(new ProductServiceException(
                                            "Inventory adjust server error: " + body))))
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(10))
                    .block();
        } catch (ProductNotFoundException | ProductServiceException ex) {
            throw ex;
        } catch (WebClientResponseException.NotFound ex) {
            throw new ProductNotFoundException(productId);
        } catch (WebClientRequestException ex) {
            log.error("Failed to reach product-service for inventory adjust productId={}", productId, ex);
            throw new ProductServiceException(
                    "Unable to reach product-service for inventory adjust: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error calling product-service inventory adjust productId={}", productId, ex);
            throw new ProductServiceException(
                    "Unexpected error calling product-service inventory adjust: " + ex.getMessage(), ex);
        }
    }

    private void applyAuthorizationHeader(HttpHeaders headers) {
        String authHeader = currentAuthorizationHeader();
        if (authHeader != null) {
            headers.set(HttpHeaders.AUTHORIZATION, authHeader);
        }
    }

    /**
     * Sets the Authorization header to the internal SERVICE-role JWT for
     * privileged service-to-service mutations (currently inventory adjust).
     * Falls back to forwarding the user's token if no service JWT is configured
     * — used in dev only; production must always have INTERNAL_SERVICE_JWT set.
     */
    private void applyServiceAuthorizationHeader(HttpHeaders headers) {
        if (internalServiceJwt != null && !internalServiceJwt.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + internalServiceJwt.trim());
        } else {
            log.warn("INTERNAL_SERVICE_JWT not configured — falling back to forwarding the user's token; "
                    + "inventory PATCH will fail for non-ADMIN callers.");
            applyAuthorizationHeader(headers);
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
