package com.ticketing.lock;

import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class RedisLockStore implements LockStore {

    private static final DefaultRedisScript<Long> DELETE_IF_EQUALS = new DefaultRedisScript<>(
            """
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else
              return 0
            end
            """,
            Long.class);

    private final StringRedisTemplate redis;

    public RedisLockStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public boolean setIfAbsent(String key, String token, long ttlMs) {
        return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, token, Duration.ofMillis(ttlMs)));
    }

    @Override
    public void deleteIfEquals(String key, String token) {
        redis.execute(DELETE_IF_EQUALS, List.of(key), token);
    }
}
