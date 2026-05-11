package com.blinkit.productservice.cache;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.function.Supplier;

/**
 * Cache-aside layer for product-service.
 *
 * <p><b>Pattern:</b> reads call {@link #getOrLoad(String, Supplier)} which
 * checks Redis first, falls through to Postgres on miss, populates the cache,
 * and returns the value. Writes call {@link #invalidate(String...)} or
 * {@link #invalidateByPattern(String...)} to drop stale entries.
 *
 * <p><b>Source of truth is Postgres.</b> Cache misses never throw — Redis
 * outages degrade to a direct-DB read, never to a 5xx. This keeps the
 * platform's blast radius small when the cache cluster blips.
 *
 * <p><b>Key schema</b> (see {@link Keys}):
 * <pre>
 *   blinkit:products:id:{id}
 *   blinkit:products:all:p{page}:s{size}:sort{sort}
 *   blinkit:products:category:{category}:p{page}:s{size}:sort{sort}
 *   blinkit:products:search:cat={cat}:name={name}:p{p}:s{s}:sort{sort}
 * </pre>
 *
 * The "category" and "all" prefixes are wildcard-evicted on any product
 * mutation so paginated listings cannot return stale rows after a write.
 */
@Slf4j
@Component
public class ProductCache {

    public static final Duration DEFAULT_TTL = Duration.ofMinutes(10);

    public static final class Keys {
        public static final String NAMESPACE      = "blinkit:products:";
        public static final String BY_ID_PREFIX   = NAMESPACE + "id:";
        public static final String ALL_PREFIX     = NAMESPACE + "all";
        public static final String CATEGORY_PREFIX = NAMESPACE + "category:";
        public static final String SEARCH_PREFIX   = NAMESPACE + "search:";

        private Keys() { }

        public static String byId(Long id) {
            return BY_ID_PREFIX + id;
        }
    }

    private final RedisTemplate<String, Object> redis;

    public ProductCache(@Qualifier("productRedisTemplate") RedisTemplate<String, Object> redis) {
        this.redis = redis;
    }

    /**
     * Cache-aside read. Looks up {@code key} in Redis. On hit, returns the
     * cached value (logging a CACHE HIT). On miss, runs {@code loader}, stores
     * the result with {@link #DEFAULT_TTL}, and returns it (logging a CACHE
     * MISS). Redis failures fall through to {@code loader} unaffected.
     */
    @SuppressWarnings("unchecked")
    public <T> T getOrLoad(String key, Supplier<T> loader) {
        try {
            Object cached = redis.opsForValue().get(key);
            if (cached != null) {
                log.info("CACHE HIT - key={}", key);
                return (T) cached;
            }
            log.info("CACHE MISS - loading from DB - key={}", key);
        } catch (Exception ex) {
            log.warn("CACHE ERROR on read, falling back to DB - key={} reason={}", key, ex.getMessage());
        }

        T value = loader.get();
        if (value != null) {
            try {
                redis.opsForValue().set(key, value, DEFAULT_TTL);
            } catch (Exception ex) {
                log.warn("CACHE ERROR on write, continuing without cache - key={} reason={}", key, ex.getMessage());
            }
        }
        return value;
    }

    /** Drop a single key (or list of fully-qualified keys). */
    public void invalidate(String... keys) {
        if (keys == null || keys.length == 0) {
            return;
        }
        try {
            Long removed = redis.delete(Arrays.asList(keys));
            log.info("CACHE INVALIDATED - keys={} removed={}", Arrays.toString(keys), removed);
        } catch (Exception ex) {
            log.warn("CACHE ERROR on invalidate, ignoring - keys={} reason={}",
                    Arrays.toString(keys), ex.getMessage());
        }
    }

    /**
     * SCAN + UNLINK any key matching one of the given glob patterns. Used to
     * sweep paginated listings on writes (since each page is its own key).
     */
    public void invalidateByPattern(String... patterns) {
        if (patterns == null || patterns.length == 0) {
            return;
        }
        for (String pattern : patterns) {
            try {
                List<String> matched = scan(pattern);
                if (!matched.isEmpty()) {
                    redis.unlink((Collection<String>) matched);
                }
                log.info("CACHE INVALIDATED - pattern={} matched={}", pattern, matched.size());
            } catch (Exception ex) {
                log.warn("CACHE ERROR on pattern invalidate, ignoring - pattern={} reason={}",
                        pattern, ex.getMessage());
            }
        }
    }

    /**
     * Convenience: invalidate everything under {@link Keys#NAMESPACE}.
     * Used when a single product mutation could affect multiple list pages
     * across categories / search filters.
     */
    public void invalidateAllProductCaches(Long productId, String reason) {
        invalidate(Keys.byId(productId));
        invalidateByPattern(
                Keys.ALL_PREFIX + "*",
                Keys.CATEGORY_PREFIX + "*",
                Keys.SEARCH_PREFIX + "*"
        );
        log.info("CACHE INVALIDATED ALL - productId={} reason={}", productId, reason);
    }

    private List<String> scan(String pattern) {
        return redis.execute((RedisCallback<List<String>>) connection -> {
            List<String> result = new ArrayList<>();
            ScanOptions opts = ScanOptions.scanOptions().match(pattern).count(256).build();
            try (Cursor<byte[]> cursor = connection.keyCommands().scan(opts)) {
                while (cursor.hasNext()) {
                    result.add(new String(cursor.next()));
                }
            }
            return result;
        });
    }
}
