"""Equivalente ao @Scheduled(fixedDelay = 60000) / jobs/expiration.ts: roda uma vez de imediato
e agenda a próxima execução `interval_ms` DEPOIS que a anterior terminar (sem sobreposição)."""
import asyncio
from typing import Awaitable, Callable

from app.logging_config import log


class ExpirationJob:
    def __init__(self, run: Callable[[], Awaitable[object]], interval_ms: int) -> None:
        self._run = run
        self._interval_ms = interval_ms
        self._stopped = False
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self._stopped = True
        if self._task is not None:
            self._task.cancel()

    async def _loop(self) -> None:
        while not self._stopped:
            try:
                await self._run()
            except Exception as error:  # noqa: BLE001
                log.error("Reservation expiration job failed: %s", error)
            if self._stopped:
                return
            await asyncio.sleep(self._interval_ms / 1000)
