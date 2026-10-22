package com.ticketing.lock;

/** Resultado de {@link RedisLockManager#tryWithLock}: {@code acquired=false} significa que o lock não foi obtido a tempo. */
public record LockResult<T>(boolean acquired, T value) {

    public static <T> LockResult<T> of(T value) {
        return new LockResult<>(true, value);
    }

    public static <T> LockResult<T> notAcquired() {
        return new LockResult<>(false, null);
    }
}
