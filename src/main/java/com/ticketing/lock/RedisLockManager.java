package com.ticketing.lock;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Lock distribuído com semântica de {@code tryLock(waitTime, leaseTime)}:
 * <ul>
 *   <li>espera até {@code waitMs} para adquirir; se não conseguir, devolve {@code acquired=false};</li>
 *   <li>o lock expira sozinho após {@code leaseMs};</li>
 *   <li>só quem adquiriu consegue liberar (token + compare-and-delete atômico);</li>
 *   <li>é <b>reentrante</b> na mesma thread: o fluxo de pagamento chama a liberação da reserva
 *       segurando o lock {@code reservation:{token}}; sem reentrância essa chamada esperaria
 *       em vão pelo próprio lock.</li>
 * </ul>
 */
@Component
public class RedisLockManager {

    private static final Logger log = LoggerFactory.getLogger(RedisLockManager.class);
    private static final String KEY_PREFIX = "lock:";

    private static final ThreadLocal<Set<String>> HELD = ThreadLocal.withInitial(HashSet::new);

    private final LockStore store;

    public RedisLockManager(LockStore store) {
        this.store = store;
    }

    public <T> LockResult<T> tryWithLock(String key, LockOptions options, Supplier<T> action) {
        Set<String> held = HELD.get();
        if (held.contains(key)) {
            // Reentrância: esta thread já é dona do lock.
            return LockResult.of(action.get());
        }

        String redisKey = KEY_PREFIX + key;
        String token = UUID.randomUUID().toString();
        long deadlineNanos = System.nanoTime() + options.waitMs() * 1_000_000L;

        while (!store.setIfAbsent(redisKey, token, options.leaseMs())) {
            long remainingMs = (deadlineNanos - System.nanoTime()) / 1_000_000L;
            if (remainingMs <= 0) {
                return LockResult.notAcquired();
            }
            sleep(Math.min(remainingMs, 25 + ThreadLocalRandom.current().nextLong(50)));
        }

        held.add(key);
        try {
            return LockResult.of(action.get());
        } finally {
            held.remove(key);
            try {
                store.deleteIfEquals(redisKey, token);
            } catch (RuntimeException error) {
                // O lease expira sozinho; não vale derrubar a requisição por isso.
                log.warn("Falha ao liberar lock {}: {}", key, error.getMessage());
            }
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for lock", e);
        }
    }
}
