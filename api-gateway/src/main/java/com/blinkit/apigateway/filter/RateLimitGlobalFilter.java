package com.blinkit.apigateway.filter;

import com.blinkit.apigateway.config.GatewayProperties;
import com.blinkit.apigateway.exception.GatewayResponseWriter;
import com.blinkit.apigateway.security.PublicRouteRegistry;
import com.blinkit.apigateway.util.ClientIpResolver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;

/**
 * Per-IP fixed-window rate limit backed by Redis.
 *
 * <p>Algorithm: {@code INCR gw:ratelimit:{ip}:{epochMinute}}; on the first
 * increment the key is given a 60-second TTL. When the counter exceeds the
 * configured per-minute quota the request is rejected with 429.
 *
 * <p><b>Fail open.</b> If Redis is unreachable, slow, or returns an error,
 * the filter logs once and lets the request through. Rate limiting is a
 * defence-in-depth feature; it must not be the reason customer traffic
 * fails. The downstream service still enforces its own auth checks, so the
 * worst case during a Redis outage is "limit not enforced", not "data leaks".
 *
 * <p>Health and docs paths skip the limit entirely so probe storms cannot
 * trip it.
 */
@Component
@Slf4j
public class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private final ReactiveStringRedisTemplate redis;
    private final GatewayResponseWriter responseWriter;
    private final ClientIpResolver ipResolver;
    private final PublicRouteRegistry publicRoutes;
    private final GatewayProperties.RateLimit config;

    public RateLimitGlobalFilter(ReactiveStringRedisTemplate redis,
                                 GatewayResponseWriter responseWriter,
                                 ClientIpResolver ipResolver,
                                 PublicRouteRegistry publicRoutes,
                                 GatewayProperties properties) {
        this.redis = redis;
        this.responseWriter = responseWriter;
        this.ipResolver = ipResolver;
        this.publicRoutes = publicRoutes;
        this.config = properties.getRatelimit();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!config.isEnabled()) {
            return chain.filter(exchange);
        }
        String path = exchange.getRequest().getURI().getPath();
        if (publicRoutes.isHealthOrDocs(path)) {
            return chain.filter(exchange);
        }

        String ip = ipResolver.resolve(exchange.getRequest());
        long windowMinute = Instant.now().getEpochSecond() / 60;
        String key = "%s:%s:%d".formatted(config.getRedisKeyPrefix(), ip, windowMinute);

        return redis.opsForValue().increment(key)
                .flatMap(count -> applyTtlIfFirstHit(key, count).thenReturn(count))
                .flatMap(count -> {
                    if (count > config.getRequestsPerMinute()) {
                        log.warn("RATE LIMIT EXCEEDED ip={} path={} count={} limit={}",
                                ip, path, count, config.getRequestsPerMinute());
                        return responseWriter.write(
                                exchange,
                                HttpStatus.TOO_MANY_REQUESTS,
                                "RATE_LIMIT_EXCEEDED",
                                "Request rate limit exceeded. Try again later.");
                    }
                    return chain.filter(exchange);
                })
                .onErrorResume(ex -> {
                    log.warn("RATE LIMIT FAILURE - allowing request (Redis error: {})",
                            ex.toString());
                    return chain.filter(exchange);
                });
    }

    private Mono<Boolean> applyTtlIfFirstHit(String key, Long count) {
        if (count != null && count == 1L) {
            return redis.expire(key, Duration.ofSeconds(60));
        }
        return Mono.just(true);
    }

    @Override
    public int getOrder() {
        return GatewayFilterOrder.RATE_LIMIT;
    }
}
