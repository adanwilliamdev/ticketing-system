package com.ticketing.lock;

/** Armazenamento atômico usado pelo lock distribuído (implementado sobre Redis em produção). */
public interface LockStore {

    /** Grava {@code token} em {@code key} com TTL somente se a chave não existir. */
    boolean setIfAbsent(String key, String token, long ttlMs);

    /** Remove {@code key} somente se o valor atual for {@code token} (compare-and-delete atômico). */
    void deleteIfEquals(String key, String token);
}
