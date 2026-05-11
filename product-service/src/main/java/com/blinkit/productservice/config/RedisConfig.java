package com.blinkit.productservice.config;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis wiring for the product-service Phase-1 cache-aside layer.
 *
 * <p>Keys are plain strings (see {@code ProductCache} for the key schema).
 * Values are JSON, serialised via Jackson with default-typing so that
 * generic containers ({@code PageResponse<ProductResponse>}) round-trip
 * cleanly. Java time types are supported via {@link JavaTimeModule}.
 *
 * <p>This bean is the single Redis touch-point for product-service. All cache
 * reads and writes go through {@code ProductCache}; nothing else in the
 * service should depend on {@link RedisTemplate} directly.
 */
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> productRedisTemplate(RedisConnectionFactory connectionFactory) {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(
                BasicPolymorphicTypeValidator.builder()
                        .allowIfSubType("com.blinkit.productservice.dto")
                        .allowIfSubType("java.util")
                        .allowIfSubType("java.lang")
                        .allowIfSubType("java.math")
                        .allowIfSubType("java.time")
                        .build(),
                ObjectMapper.DefaultTyping.NON_FINAL);

        GenericJackson2JsonRedisSerializer valueSerializer = new GenericJackson2JsonRedisSerializer(mapper);

        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(StringRedisSerializer.UTF_8);
        template.setHashKeySerializer(StringRedisSerializer.UTF_8);
        template.setValueSerializer(valueSerializer);
        template.setHashValueSerializer(valueSerializer);
        template.afterPropertiesSet();
        return template;
    }
}
