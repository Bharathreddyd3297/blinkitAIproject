package com.blinkit.apigateway.security;

import com.blinkit.apigateway.config.GatewayProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.util.PathMatcher;

import java.util.List;

/**
 * Single source of truth for which paths bypass JWT validation.
 *
 * <p>Backed by the {@code gateway.security.public-paths} list in
 * {@code application.yml}. Used by both
 * {@link com.blinkit.apigateway.filter.JwtAuthenticationGlobalFilter}
 * (skip auth for these) and the rate-limit filter (skip rate limiting for
 * health probes so a noisy probe loop never trips a limit).
 */
@Component
public class PublicRouteRegistry {

    private final PathMatcher matcher = new AntPathMatcher();
    private final List<String> publicPatterns;

    public PublicRouteRegistry(GatewayProperties properties) {
        this.publicPatterns = properties.getSecurity().getPublicPaths();
    }

    public boolean isPublic(String path) {
        if (path == null) {
            return false;
        }
        for (String pattern : publicPatterns) {
            if (matcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    public boolean isHealthOrDocs(String path) {
        return path != null && (
                path.startsWith("/actuator")
                        || path.startsWith("/health")
                        || path.startsWith("/swagger-ui")
                        || path.startsWith("/v3/api-docs")
                        || path.startsWith("/webjars")
                        || path.equals("/favicon.ico"));
    }
}
