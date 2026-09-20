"""Lock distribuído baseado em Redis — equivalente a lock.ts (substitui o RLock do Redisson).

Semântica portada de `lock.tryLock(waitTime, leaseTime)`:
 - espera até `wait_ms` para adquirir; se não conseguir, devolve `acquired=False`;
 - o lock expira sozinho após `lease_ms` (protege contra processo que morreu com o lock);
 - só quem adquiriu consegue liberar (token + compare-and-delete atômico via Lua);
 - é REENTRANTE dentro da mesma cadeia assíncrona (via contextvars), como o RLock é reentrante
   por thread. Isso importa: o fluxo de pagamento chama release_active_reservation() segurando
   o lock `reservation:{token}`. Sem reentrância, essa chamada esperaria em vão pelo próprio lock.
"""
import asyncio
import random
import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Awaitable, Callable, Generic, TypeVar

from redis.asyncio import Redis

from app.logging_config import log

T = TypeVar("T")

KEY_PREFIX = "lock:"

_DELETE_IF_EQUALS = """
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
"""

_held_locks: ContextVar[frozenset[str]] = ContextVar("_held_locks", default=frozenset())


@dataclass
class LockOptions:
    wait_ms: int
    lease_ms: int


@dataclass
class LockResult(Generic[T]):
    acquired: bool
    value: T | None = None


class RedisLockManager:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def _set_if_absent(self, key: str, token: str, ttl_ms: int) -> bool:
        return bool(await self._redis.set(key, token, px=ttl_ms, nx=True))

    async def _delete_if_equals(self, key: str, token: str) -> bool:
        result = await self._redis.eval(_DELETE_IF_EQUALS, 1, key, token)
        return result == 1

    async def try_with_lock(
        self, key: str, options: LockOptions, fn: Callable[[], Awaitable[T]]
    ) -> LockResult[T]:
        already_held = _held_locks.get()
        if key in already_held:
            # Reentrância: esta cadeia assíncrona já é dona do lock.
            return LockResult(acquired=True, value=await fn())

        redis_key = KEY_PREFIX + key
        token = str(uuid.uuid4())
        deadline = asyncio.get_event_loop().time() + options.wait_ms / 1000

        while True:
            if await self._set_if_absent(redis_key, token, options.lease_ms):
                break
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                return LockResult(acquired=False)
            await asyncio.sleep(min(remaining, (25 + random.random() * 50) / 1000))

        token_set = _held_locks.set(already_held | {key})
        try:
            value = await fn()
            return LockResult(acquired=True, value=value)
        finally:
            _held_locks.reset(token_set)
            try:
                await self._delete_if_equals(redis_key, token)
            except Exception as error:  # noqa: BLE001
                # O lease expira sozinho; não vale derrubar a requisição por isso.
                log.warning("Falha ao liberar lock %s: %s", key, error)
