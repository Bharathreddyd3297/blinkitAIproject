package com.blinkit.apigateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Structured access log for every request that traverses the gateway.
 *
 * <p>Output shape (single line, key=value):
 * <pre>
 * REQUEST - method=GET path=/api/products status=200 duration=35ms user=42 ip=10.0.0.4
 * </pre>
 *
 * <p>The {@code user} value comes from the JWT filter
 * ({@link JwtAuthenticationGlobalFilter#USER_ID_ATTRIBUTE}). On unauthenticated
 * paths the field is dropped from the log line entirely.
 *
 * <p>Runs first so the response-side hook fires <i>after</i> all the routing
 * filters have updated the response status.
 */
@Component
@Slf4j
public class RequestLoggingGlobalFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startNanos = System.nanoTime();
        String method = exchange.getRequest().getMethod().name();
        String path = exchange.getRequest().getURI().getPath();

        return chain.filter(exchange).doFinally(signal -> {
            long durationMs = (System.nanoTime() - startNanos) / 1_000_000L;
            HttpStatusCode status = exchange.getResponse().getStatusCode();
            int statusCode = status == null ? 0 : status.value();
            Object userId = exchange.getAttribute(JwtAuthenticationGlobalFilter.USER_ID_ATTRIBUTE);

            if (userId != null) {
                log.info("REQUEST - method={} path={} status={} duration={}ms user={}",
                        method, path, statusCode, durationMs, userId);
            } else {
                log.info("REQUEST - method={} path={} status={} duration={}ms",
                        method, path, statusCode, durationMs);
            }
        });
    }

    @Override
    public int getOrder() {
        return GatewayFilterOrder.LOGGING;
    }
}
