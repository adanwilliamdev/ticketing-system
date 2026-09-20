"""Equivalente a repositories/events.ts."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event


async def find_by_id(session: AsyncSession, event_id: int) -> Event | None:
    return await session.get(Event, event_id)


async def find_by_id_for_update(session: AsyncSession, event_id: int) -> Event | None:
    result = await session.execute(select(Event).where(Event.id == event_id).with_for_update())
    return result.scalar_one_or_none()


async def find_available(session: AsyncSession) -> list[Event]:
    result = await session.execute(
        select(Event)
        .where(Event.available_tickets > 0, Event.status == "PUBLISHED")
        .order_by(Event.start_date_time, Event.id)
    )
    return list(result.scalars().all())


async def decrement_available(session: AsyncSession, event_id: int) -> None:
    event = await session.get(Event, event_id)
    if event is not None:
        event.available_tickets -= 1
        event.version = (event.version or 0) + 1


async def increment_available(session: AsyncSession, event_id: int) -> None:
    event = await session.get(Event, event_id)
    if event is not None:
        event.available_tickets += 1
        event.version = (event.version or 0) + 1
