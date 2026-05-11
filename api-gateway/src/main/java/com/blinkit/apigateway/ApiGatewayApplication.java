package com.blinkit.apigateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Blinkit API Gateway — single ingress for all external traffic into the
 * platform. Routes /api/** to the correct downstream service, pre-validates
 * JWTs against the shared HS512 secret, and applies per-IP Redis rate limits.
 *
 * <p>Built on Spring Cloud Gateway (reactive / WebFlux). Stateless; scales
 * horizontally behind any L4 load balancer.
 */
@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
