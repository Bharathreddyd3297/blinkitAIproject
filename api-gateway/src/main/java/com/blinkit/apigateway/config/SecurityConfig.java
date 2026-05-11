package com.blinkit.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

/**
 * Reactive security baseline for the gateway.
 *
 * <p>The gateway intentionally permits everything at the Spring Security
 * layer. Authentication is enforced by
 * {@link com.blinkit.apigateway.filter.JwtAuthenticationGlobalFilter}, which
 * runs in the gateway filter chain (not the security chain) so that:
 *
 * <ul>
 *   <li>It can short-circuit with the platform's standard
 *       {@code ApiResponse} envelope on 401, instead of Spring Security's
 *       default WWW-Authenticate response.</li>
 *   <li>Public-path matching is centrally configured under
 *       {@code gateway.security.public-paths} in application.yml and used by
 *       both the JWT filter and the rate-limit filter.</li>
 *   <li>Downstream services still validate the JWT independently — the
 *       gateway is defense in depth, not the trust boundary.</li>
 * </ul>
 *
 * <p>CSRF is disabled because the gateway only proxies API traffic; CORS is
 * handled by Spring Cloud Gateway's globalcors configuration.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .logout(ServerHttpSecurity.LogoutSpec::disable)
                .authorizeExchange(exchanges -> exchanges.anyExchange().permitAll())
                .build();
    }
}
