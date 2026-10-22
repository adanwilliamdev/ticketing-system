package com.ticketing.lock;

/**
 * @param waitMs  tempo máximo esperando para adquirir o lock
 * @param leaseMs tempo após o qual o lock expira sozinho (protege contra processo que morreu com ele)
 */
public record LockOptions(long waitMs, long leaseMs) {
}
