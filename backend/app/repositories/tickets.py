"""Equivalente a repositories/tickets.ts."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ticket


async def find_by_id_for_update(session: AsyncSession, ticket_id: int) -> Ticket | None:
    result = await session.execute(select(Ticket).where(Ticket.id == ticket_id).with_for_update())
    return result.scalar_one_or_none()


async def find_by_event_and_seat_for_update(session: AsyncSession, event_id: int, seat_number: str) -> Ticket | None:
    result = await session.execute(
        select(Ticket).where(Ticket.event_id == event_id, Ticket.seat_number == seat_number).with_for_update()
    )
    return result.scalar_one_or_none()


async def list_by_event(session: AsyncSession, event_id: int) -> list[Ticket]:
    result = await session.execute(select(Ticket).where(Ticket.event_id == event_id).order_by(Ticket.id))
    return list(result.scalars().all())


async def update_status(session: AsyncSession, ticket_id: int, status: str) -> None:
    ticket = await session.get(Ticket, ticket_id)
    if ticket is not None:
        ticket.status = status
        ticket.version = (ticket.version or 0) + 1
