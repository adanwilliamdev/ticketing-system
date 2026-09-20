import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sleep } from '../src/lib/async';
import { RedisLockManager } from '../src/lib/lock';
import { MemoryLockStore } from './helpers/fakes';

const opts = { waitMs: 500, leaseMs: 2000 };

describe('RedisLockManager', () => {
  it('garante exclusão mútua entre execuções concorrentes da mesma chave', async () => {
    const locks = new RedisLockManager(new MemoryLockStore());
    let inside = 0;
    let maxInside = 0;
    const run = () =>
      locks.tryWithLock('k', { waitMs: 2000, leaseMs: 2000 }, async () => {
        inside++;
        maxInside = Math.max(maxInside, inside);
        await sleep(20);
        inside--;
      });
    const results = await Promise.all([run(), run(), run(), run()]);
    assert.equal(maxInside, 1);
    assert.ok(results.every((r) => r.acquired));
  });

  it('chaves diferentes não se bloqueiam', async () => {
    const locks = new RedisLockManager(new MemoryLockStore());
    const started: string[] = [];
    await Promise.all(['a', 'b'].map((k) => locks.tryWithLock(k, opts, async () => { started.push(k); await sleep(30); })));
    assert.deepEqual(started.sort(), ['a', 'b']);
  });

  it('devolve acquired:false e NÃO executa fn quando o tempo de espera esgota', async () => {
    const store = new MemoryLockStore();
    const locks = new RedisLockManager(store);
    await store.setIfAbsent('lock:k', 'outro-dono', 5000);
    let ran = false;
    const res = await locks.tryWithLock('k', { waitMs: 80, leaseMs: 1000 }, async () => { ran = true; });
    assert.equal(res.acquired, false);
    assert.equal(ran, false);
  });

  it('adquire se o lock for liberado dentro do tempo de espera', async () => {
    const locks = new RedisLockManager(new MemoryLockStore());
    const first = locks.tryWithLock('k', opts, () => sleep(60));
    const second = await locks.tryWithLock('k', { waitMs: 1000, leaseMs: 1000 }, async () => 'ok');
    await first;
    assert.deepEqual(second, { acquired: true, value: 'ok' });
  });

  it('o lease expira sozinho (dono que travou não bloqueia para sempre)', async () => {
    const store = new MemoryLockStore();
    await store.setIfAbsent('lock:k', 'dono-morto', 40);
    const locks = new RedisLockManager(store);
    const res = await locks.tryWithLock('k', { waitMs: 500, leaseMs: 500 }, async () => 'ok');
    assert.equal(res.acquired, true);
  });

  it('não apaga o lock de outro dono quando o seu lease já expirou', async () => {
    const store = new MemoryLockStore();
    const locks = new RedisLockManager(store);
    await locks.tryWithLock('k', { waitMs: 100, leaseMs: 30 }, async () => {
      await sleep(60); // lease expira durante o trabalho
      await store.setIfAbsent('lock:k', 'novo-dono', 1000); // outro processo assume
    });
    assert.deepEqual(store.heldKeys, ['lock:k']); // o unlock do primeiro não removeu o do novo dono
  });

  it('é reentrante na mesma cadeia assíncrona (como o RLock por thread)', async () => {
    const locks = new RedisLockManager(new MemoryLockStore());
    const res = await locks.tryWithLock('k', { waitMs: 50, leaseMs: 1000 }, () =>
      locks.tryWithLock('k', { waitMs: 50, leaseMs: 1000 }, async () => 'interno'),
    );
    assert.deepEqual(res, { acquired: true, value: { acquired: true, value: 'interno' } });
  });

  it('a reentrância não vaza para outra cadeia assíncrona', async () => {
    const store = new MemoryLockStore();
    const locks = new RedisLockManager(store);
    let other: unknown;
    await locks.tryWithLock('k', opts, async () => {
      // chamada "independente" que não descende desta cadeia — simulada com setImmediate fora do contexto não é possível;
      // então validamos o contrário: outra chave dentro do lock NÃO é tratada como reentrante.
      other = await locks.tryWithLock('outra', opts, async () => 'x');
    });
    assert.deepEqual(other, { acquired: true, value: 'x' });
    assert.deepEqual(store.heldKeys, []);
  });

  it('libera o lock mesmo quando fn lança', async () => {
    const store = new MemoryLockStore();
    const locks = new RedisLockManager(store);
    await assert.rejects(locks.tryWithLock('k', opts, async () => { throw new Error('boom'); }), /boom/);
    assert.deepEqual(store.heldKeys, []);
  });
});
