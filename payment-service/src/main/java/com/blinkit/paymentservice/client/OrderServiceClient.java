package com.blinkit.paymentservice.client;

import com.blinkit.paymentservice.dto.request.UpdateOrderStatusRequest;
import com.blinkit.paymentservice.dto.response.ApiResponse;
import com.blinkit.paymentservice.dto.response.OrderResponse;
import com.blinkit.paymentservice.exception.OrderNotFoundException;
import com.blinkit.paymentservice.exception.OrderServiceException;
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
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * WebClient-backed adapter for order-service.
 *
 * <p><b>JWT propagation:</b> for every outbound call this client copies the
 * inbound request's {@code Authorization: Bearer ...} header onto the
 * outbound request via {@link #currentAuthorizationHeader()}. order-service
 * authorises the action against the user encoded in that JWT — payment-service
 * does NOT trust a userId carried in the URL/body, the token IS the identity.
 *
 * <p>order-service wraps every body in {@code ApiResponse<T>}; we deserialize
 * with a {@link ParameterizedTypeReference} and unwrap the {@code data} field.
 */
@Slf4j
@Component
public class OrderServiceClient {

    private static final String ORDER_BY_ID_PATH = "/api/orders/{id}";
    private static final String ORDER_STATUS_PATH = "/api/orders/{id}/status";

    private final WebClient orderServiceWebClient;

    public OrderServiceClient(@Qualifier("orderServiceWebClient") WebClient orderServiceWebClient) {
        this.orderServiceWebClient = orderServiceWebClient;
    }

    /**
     * Fetch the order with the given id from order-service. The downstream service
     * verifies that the order is owned by the authenticated user (encoded in JWT)
     * and returns 401/403 otherwise.
     */
    public OrderResponse getOrderById(Long orderId) {
        log.debug("Fetching order id={} from order-service", orderId);
        try {
            ApiResponse<OrderResponse> envelope = orderServiceWebClient.get()
                    .uri(ORDER_BY_ID_PATH, orderId)
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(this::applyAuthorizationHeader)
                    .retrieve()
                    .onStatus(status -> status.value() == HttpStatus.NOT_FOUND.value(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Order not found")
                                    .flatMap(body -> Mono.error(new OrderNotFoundException(orderId))))
                    .onStatus(status -> status.is4xxClientError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Client error")
                                    .flatMap(body -> Mono.error(new OrderServiceException(
                                            "Order service client error: " + body))))
                    .onStatus(status -> status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Server error")
                                    .flatMap(body -> Mono.error(new OrderServiceException(
                                            "Order service server error: " + body))))
                    .bodyToMono(new ParameterizedTypeReference<ApiResponse<OrderResponse>>() {})
                    .timeout(Duration.ofSeconds(15))
                    .block();
            return envelope != null ? envelope.getData() : null;
        } catch (OrderNotFoundException | OrderServiceException ex) {
            throw ex;
        } catch (WebClientRequestException ex) {
            log.error("Failed to reach order-service when fetching order {}", orderId, ex);
            throw new OrderServiceException(
                    "Unable to reach order-service: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error calling order-service for order {}", orderId, ex);
            throw new OrderServiceException(
                    "Unexpected error calling order-service: " + ex.getMessage(), ex);
        }
    }

    /**
     * Update an order's status on order-service after a payment lifecycle event.
     * Maps {@code PAYMENT_SUCCESS -> PAID} and {@code PAYMENT_FAILED -> FAILED}
     * (see PaymentServiceImpl for the mapping).
     *
     * <p>This is best-effort from the caller's POV: if order-service is unreachable
     * the payment record is already persisted with the correct status, and the
     * platform's reconciliation layer is expected to re-drive the order update.
     */
    public OrderResponse updateOrderStatus(Long orderId, String status) {
        log.info("Updating order id={} status={} via order-service", orderId, status);
        try {
            UpdateOrderStatusRequest body = UpdateOrderStatusRequest.builder()
                    .status(status)
                    .build();

            ApiResponse<OrderResponse> envelope = orderServiceWebClient.patch()
                    .uri(ORDER_STATUS_PATH, orderId)
                    .accept(MediaType.APPLICATION_JSON)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(this::applyAuthorizationHeader)
                    .bodyValue(body)
                    .retrieve()
                    .onStatus(status0 -> status0.value() == HttpStatus.NOT_FOUND.value(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Order not found")
                                    .flatMap(b -> Mono.error(new OrderNotFoundException(orderId))))
                    .onStatus(status0 -> status0.is4xxClientError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Client error")
                                    .flatMap(b -> Mono.error(new OrderServiceException(
                                            "Order service client error on status update: " + b))))
                    .onStatus(status0 -> status0.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .defaultIfEmpty("Server error")
                                    .flatMap(b -> Mono.error(new OrderServiceException(
                                            "Order service server error on status update: " + b))))
                    .bodyToMono(new ParameterizedTypeReference<ApiResponse<OrderResponse>>() {})
                    .timeout(Duration.ofSeconds(15))
                    .block();
            return envelope != null ? envelope.getData() : null;
        } catch (OrderNotFoundException | OrderServiceException ex) {
            throw ex;
        } catch (WebClientRequestException ex) {
            log.error("Failed to reach order-service to update order {}", orderId, ex);
            throw new OrderServiceException(
                    "Unable to reach order-service to update status: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error calling order-service to update order {}", orderId, ex);
            throw new OrderServiceException(
                    "Unexpected error updating order status: " + ex.getMessage(), ex);
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
