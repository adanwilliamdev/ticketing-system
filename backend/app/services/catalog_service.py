"""Não existia no projeto original (só havia API de reservas e pagamentos); é o mínimo que o
front-end precisa para listar eventos e desenhar o mapa de assentos. Equivalente a
services/catalog-service.ts."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.errors import ResourceNotFoundError
from app.models import Event, Ticket
from app.repositories import events as events_repo
from app.repositories import tickets as tickets_repo


class CatalogService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def list_available_events(self) -> list[Event]:
        async with self._session_factory() as session:
            return await events_repo.find_available(session)

    async def get_event(self, event_id: int) -> Event:
        async with self._session_factory() as session:
            event = await events_repo.find_by_id(session, event_id)
        if event is None:
            raise ResourceNotFoundError("Event not found")
        return event

    async def list_seats(self, event_id: int) -> list[Ticket]:
        await self.get_event(event_id)
        async with self._session_factory() as session:
            return await tickets_repo.list_by_event(session, event_id)
