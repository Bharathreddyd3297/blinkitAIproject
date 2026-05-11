package com.blinkit.cartservice.client;

import com.blinkit.cartservice.dto.response.ApiResponse;
import com.blinkit.cartservice.dto.response.ProductResponse;
import com.blinkit.cartservice.exception.ProductNotFoundException;
import com.blinkit.cartservice.exception.ProductServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
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

/**
 * WebClient-backed adapter for product-service.
 *
 * <p><b>JWT propagation:</b> for every outbound call this client copies the
 * inbound request's {@code Authorization: Bearer ...} header onto the
 * outbound request via {@link #currentAuthorizationHeader()}. This is what
 * lets product-service authenticate the original end-user when cart-service
 * fans out to it — no service account, no token re-issue, the user's token
 * simply rides along. Both services validate it with the SAME shared
 * {@code JWT_SECRET}.
 */
@Slf4j
@Component
public class ProductServiceClient {

    private static final String PRODUCT_BY_ID_PATH = "/api/products/{id}";

    private final WebClient productServiceWebClient;

    public ProductServiceClient(@Qualifier("productServiceWebClient") WebClient productServiceWebClient) {
        this.productServiceWebClient = productServiceWebClient;
    }

    public ProductResponse getProductById(Long productId) {
        log.debug("Fetching product details for productId={}", productId);
        try {
            ApiResponse<ProductResponse> envelope = productServiceWebClient.get()
                    .uri(PRODUCT_BY_ID_PATH, productId)
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        String authHeader = currentAuthorizationHeader();
                        if (authHeader != null) {
                            headers.set(HttpHeaders.AUTHORIZATION, authHeader);
                        }
                    })
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
                    .timeout(Duration.ofSeconds(5))
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
