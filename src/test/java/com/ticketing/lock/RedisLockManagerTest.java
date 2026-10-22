package com.ticketing.lock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RedisLockManagerTest {

    /** Implementação em memória com a mesma semântica de set-if-absent / compare-and-delete. */
    static class InMemoryStore implements LockStore {
        final Map<String, String> data = new HashMap<>();

        @Override
        public synchronized boolean setIfAbsent(String key, String token, long ttlMs) {
            return data.putIfAbsent(key, token) == null;
        }

        @Override
        public synchronized void deleteIfEquals(String key, String token) {
            data.remove(key, token);
        }
    }

    private final InMemoryStore store = new InMemoryStore();
    private final RedisLockManager locks = new RedisLockManager(store);

    @Test
    void runsActionAndReleasesLock() {
        LockResult<String> result = locks.tryWithLock("k", new LockOptions(100, 1000), () -> {
            assertTrue(store.data.containsKey("lock:k"));
            return "ok";
        });

        assertTrue(result.acquired());
        assertEquals("ok", result.value());
        assertTrue(store.data.isEmpty());
    }

    @Test
    void releasesLockWhenActionThrows() {
        try {
            locks.tryWithLock("k", new LockOptions(100, 1000), () -> {
                throw new IllegalStateException("boom");
            });
        } catch (IllegalStateException expected) {
            // esperado
        }
        assertTrue(store.data.isEmpty());
    }

    @Test
    void notAcquiredWhenLockIsHeldByAnotherOwner() {
        store.data.put("lock:k", "someone-else");

        LockResult<String> result = locks.tryWithLock("k", new LockOptions(60, 1000), () -> "never");

        assertFalse(result.acquired());
        assertEquals("someone-else", store.data.get("lock:k"));
    }

    @Test
    void isReentrantOnTheSameThread() {
        LockResult<String> result = locks.tryWithLock("k", new LockOptions(100, 1000),
                () -> locks.tryWithLock("k", new LockOptions(100, 1000), () -> "inner").value());

        assertTrue(result.acquired());
        assertEquals("inner", result.value());
        assertTrue(store.data.isEmpty());
    }

    @Test
    void doesNotReleaseSomeoneElsesLock() {
        locks.tryWithLock("k", new LockOptions(100, 1000), () -> {
            store.data.put("lock:k", "stolen-after-lease-expiry");
            return null;
        });

        assertEquals("stolen-after-lease-expiry", store.data.get("lock:k"));
    }
}
