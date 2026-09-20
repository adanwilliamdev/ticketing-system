import Redis from 'ioredis';
import { log } from './logger';
import type { LockStore } from './lock';

export type RedisClient = Redis;

export function createRedis(url: string): RedisClient {
  const client = new Redis(url, {
    connectTimeout: 2000, // spring.data.redis.timeout: 2000ms
    maxRetriesPerRequest: 2,
    lazyConnect: true, // só conecta no primeiro comando (evita conexão durante o build)
  });
  client.on('error', (error: Error) => log.warn(`Redis: ${error.message}`));
  return client;
}

const DELETE_IF_EQUALS = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export function createRedisLockStore(client: RedisClient): LockStore {
  return {
    async setIfAbsent(key, token, ttlMs) {
      const reply = await client.set(key, token, 'PX', ttlMs, 'NX');
      return reply === 'OK';
    },
    async deleteIfEquals(key, token) {
      const deleted = await client.eval(DELETE_IF_EQUALS, 1, key, token);
      return deleted === 1;
    },
  };
}
