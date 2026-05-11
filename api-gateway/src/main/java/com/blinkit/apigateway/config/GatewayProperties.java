package com.blinkit.apigateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Strongly-typed binding for everything under the {@code gateway.*} prefix in
 * {@code application.yml}.
 *
 * <p>Centralising it here means filters and validators can ask for the bean
 * instead of re-declaring {@code @Value} keys, and a config typo fails at
 * boot time instead of at first request.
 */
@Configuration("blinkitGatewayProperties") // explicit bean name avoids clashing with Spring Cloud Gateway's own gatewayProperties bean
@ConfigurationProperties(prefix = "gateway")
@Data
public class GatewayProperties {

    private final Jwt jwt = new Jwt();
    private final Security security = new Security();
    private final RateLimit ratelimit = new RateLimit();

    @Data
    public static class Jwt {
        /** Shared HS512 secret. Identical in every Blinkit service. */
        private String secret;
    }

    @Data
    public static class Security {
        /** Ant-style paths that bypass JWT validation. */
        private List<String> publicPaths = List.of();
    }

    @Data
    public static class RateLimit {
        private boolean enabled = true;
        private int requestsPerMinute = 100;
        private String redisKeyPrefix = "gw:ratelimit";
    }
}
