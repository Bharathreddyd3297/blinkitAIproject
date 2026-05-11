package com.blinkit.apigateway.filter;

/**
 * Single place that defines the relative order of every gateway global
 * filter. Lower number = runs earlier on the request, later on the response.
 *
 * <p>Spring Cloud Gateway's built-in routing filter runs at
 * {@code Ordered.LOWEST_PRECEDENCE - 1}. Anything we add must run before
 * that to affect routing decisions.
 *
 * <p>Order:
 * <ol>
 *   <li>{@link RequestLoggingGlobalFilter} (-100) — captures start time;
 *       on the response side, logs after the routing filter has set the
 *       response status.</li>
 *   <li>{@link RateLimitGlobalFilter} (-50) — drops abusive traffic before
 *       we spend cycles validating its JWT.</li>
 *   <li>{@link JwtAuthenticationGlobalFilter} (-40) — rejects unauthenticated
 *       traffic before it reaches a downstream service.</li>
 * </ol>
 */
final class GatewayFilterOrder {

    static final int LOGGING = -100;
    static final int RATE_LIMIT = -50;
    static final int JWT_AUTH = -40;

    private GatewayFilterOrder() {}
}
