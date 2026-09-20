// Lock distribuído — substitui o RLock do Redisson.
//
// Semântica portada de `lock.tryLock(waitTime, leaseTime)`:
//  - espera até `waitMs` para adquirir; se não conseguir, devolve `acquired: false`;
//  - o lock expira sozinho após `leaseMs` (protege contra processo que morreu com o lock);
//  - só quem adquiriu consegue liberar (token + compare-and-delete atômico);
//  - é REENTRANTE dentro da mesma cadeia assíncrona, como o RLock é reentrante por thread.
//    Isso importa: no projeto original, o fluxo de pagamento chama releaseReservation() segurando
//    o lock `reservation:{token}`. Sem reentrância, essa chamada esperaria em vão pelo próprio lock.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { sleep } from './async';
import { log } from './logger';

export interface LockOptions {
  waitMs: number;
  leaseMs: number;
}

export type LockResult<T> = { acquired: true; value: T } | { acquired: false };

export interface LockManager {
  /** Executa `fn` segurando o lock `key`. Se o lock não for obtido em `waitMs`, `fn` NÃO executa. */
  tryWithLock<T>(key: string, options: LockOptions, fn: () => Promise<T>): Promise<LockResult<T>>;
}

/** Operações mínimas de que o lock precisa do Redis (facilita testar com uma versão em memória). */
export interface LockStore {
  /** SET key token PX ttl NX — devolve true se o lock foi criado. */
  setIfAbsent(key: string, token: string, ttlMs: number): Promise<boolean>;
  /** Apaga a chave somente se ainda guardar `token`. */
  deleteIfEquals(key: string, token: string): Promise<boolean>;
}

const KEY_PREFIX = 'lock:';

export class RedisLockManager implements LockManager {
  private readonly store: LockStore;
  private readonly held = new AsyncLocalStorage<ReadonlySet<string>>();

  constructor(store: LockStore) {
    this.store = store;
  }

  async tryWithLock<T>(key: string, options: LockOptions, fn: () => Promise<T>): Promise<LockResult<T>> {
    const alreadyHeld = this.held.getStore();
    if (alreadyHeld?.has(key)) {
      // Reentrância: esta cadeia assíncrona já é dona do lock.
      return { acquired: true, value: await fn() };
    }

    const redisKey = KEY_PREFIX + key;
    const token = randomUUID();
    const deadline = Date.now() + options.waitMs;

    for (;;) {
      if (await this.store.setIfAbsent(redisKey, token, options.leaseMs)) break;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { acquired: false };
      await sleep(Math.min(remaining, 25 + Math.random() * 50));
    }

    const nextHeld = new Set(alreadyHeld ?? []);
    nextHeld.add(key);
    try {
      const value = await this.held.run(nextHeld, fn);
      return { acquired: true, value };
    } finally {
      try {
        await this.store.deleteIfEquals(redisKey, token);
      } catch (error) {
        // O lease expira sozinho; não vale derrubar a requisição por isso.
        log.warn(`Falha ao liberar lock ${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
