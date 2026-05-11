package com.blinkit.apigateway.util;

import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.InetSocketAddress;

/**
 * Resolves the originating client IP for rate-limit keying.
 *
 * <p>Honours {@code X-Forwarded-For} (left-most entry) when present — this is
 * what an upstream load balancer / Kubernetes ingress / Azure Application
 * Gateway sets — and falls back to the direct remote address otherwise.
 * Falls back to {@code "unknown"} so a malformed request still gets a stable
 * key (and is therefore still rate-limited as a group instead of bypassing).
 */
@Component
public class ClientIpResolver {

    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String X_REAL_IP = "X-Real-IP";

    public String resolve(ServerHttpRequest request) {
        HttpHeaders headers = request.getHeaders();

        String xff = headers.getFirst(X_FORWARDED_FOR);
        if (StringUtils.hasText(xff)) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }

        String xri = headers.getFirst(X_REAL_IP);
        if (StringUtils.hasText(xri)) {
            return xri.trim();
        }

        InetSocketAddress remote = request.getRemoteAddress();
        if (remote != null && remote.getAddress() != null) {
            return remote.getAddress().getHostAddress();
        }
        return "unknown";
    }
}
