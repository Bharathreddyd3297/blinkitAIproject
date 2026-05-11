package com.blinkit.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;

/**
 * Reactive Redis wiring for the gateway.
 *
 * <p>Only used by the rate-limit filter — the gateway holds no other Redis
 * state. Connection details come from {@code spring.data.redis.*} which
 * auto-configures the {@link ReactiveRedisConnectionFactory}; we just need a
 * string-keyed template for {@code INCR}/{@code EXPIRE} on counter keys.
 *
 * <p>Per the Phase-2 plan in {@code REDIS_INTEGRATION_PLAN.md}, the gateway
 * owns the {@code gw:} key prefix; no other service reads or writes it.
 */
@Configuration
public class RedisConfig {

    @Bean
    public ReactiveStringRedisTemplate reactiveStringRedisTemplate(
            ReactiveRedisConnectionFactory connectionFactory) {
        return new ReactiveStringRedisTemplate(connectionFactory);
    }
}
