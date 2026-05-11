package com.blinkit.apigateway.filter;

import com.blinkit.apigateway.exception.GatewayResponseWriter;
import com.blinkit.apigateway.exception.JwtValidationException;
import com.blinkit.apigateway.security.JwtTokenValidator;
import com.blinkit.apigateway.security.PublicRouteRegistry;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Validates the inbound {@code Authorization: Bearer …} header against the
 * shared HS512 secret on every request that is not whitelisted.
 *
 * <p>Public paths (auth endpoints, health, swagger, etc.) bypass validation.
 * All other paths must carry a valid token; invalid / expired / missing
 * tokens are rejected at the edge with a 401 envelope and never touch a
 * downstream service.
 *
 * <p>The header itself is left intact and forwarded — downstream services
 * still validate the token independently. The gateway is defense in depth,
 * not the trust boundary.
 *
 * <p>The validated {@code userId} is stashed on the exchange attributes so
 * the request-logging filter can include it in access logs without re-parsing
 * the JWT.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationGlobalFilter implements GlobalFilter, Ordered {

    public static final String USER_ID_ATTRIBUTE = "blinkit.userId";

    private final JwtTokenValidator validator;
    private final PublicRouteRegistry publicRoutes;
    private final GatewayResponseWriter responseWriter;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (publicRoutes.isPublic(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        try {
            Claims claims = validator.parseAndValidate(authHeader);
            Object userId = claims.get("userId");
            if (userId != null) {
                exchange.getAttributes().put(USER_ID_ATTRIBUTE, userId.toString());
            }
            return chain.filter(exchange);
        } catch (JwtValidationException ex) {
            log.debug("JWT rejected path={} code={} reason={}",
                    path, ex.getErrorCode(), ex.getMessage());
            return responseWriter.write(
                    exchange, HttpStatus.UNAUTHORIZED, ex.getErrorCode(), ex.getMessage());
        }
    }

    @Override
    public int getOrder() {
        return GatewayFilterOrder.JWT_AUTH;
    }
}
