"""Equivalente a repositories/reservations.ts.

Toda leitura de reserva já traz nome/preço do evento e o número do assento (o que a API sempre
precisa), evitando N+1 — mesmo espírito do JOIN feito no original. `ReservationView` é o
equivalente ao tipo `Reservation` "achatado" de types.ts.
"""
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event, Reservation, Ticket


@dataclass
class ReservationView:
    id: int
    reservation_token: str
    event_id: int
    ticket_id: int
    user_id: str | None
    user_email: str | None
    expires_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime
    event_name: str
    event_price: str
    seat_number: str


def _select_joined():
    return select(
        Reservation.id,
        Reservation.reservation_token,
        Reservation.event_id,
        Reservation.ticket_id,
        Reservation.user_id,
        Reservation.user_email,
        Reservation.expires_at,
        Reservation.status,
        Reservation.created_at,
        Reservation.updated_at,
        Event.name.label("event_name"),
        Event.price.label("event_price"),
        Ticket.seat_number,
    ).join(Event, Event.id == Reservation.event_id).join(Ticket, Ticket.id == Reservation.ticket_id)


def _to_view(row) -> ReservationView:
    return ReservationView(
        id=row.id,
        reservation_token=row.reservation_token,
        event_id=row.event_id,
        ticket_id=row.ticket_id,
        user_id=row.user_id,
        user_email=row.user_email,
        expires_at=row.expires_at,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        event_name=row.event_name,
        event_price=str(row.event_price),
        seat_number=row.seat_number,
    )


async def find_by_token(session: AsyncSession, token: str) -> ReservationView | None:
    result = await session.execute(_select_joined().where(Reservation.reservation_token == token))
    row = result.first()
    return _to_view(row) if row else None


async def find_by_id_for_update(session: AsyncSession, reservation_id: int) -> ReservationView | None:
    # FOR UPDATE OF r: trava só a linha da reserva (evento e assento são travados à parte, em ordem fixa).
    result = await session.execute(
        _select_joined().where(Reservation.id == reservation_id).with_for_update(of=Reservation)
    )
    row = result.first()
    return _to_view(row) if row else None


async def exists_active_for_ticket(session: AsyncSession, ticket_id: int) -> bool:
    result = await session.execute(
        select(Reservation.id).where(Reservation.ticket_id == ticket_id, Reservation.status == "ACTIVE").limit(1)
    )
    return result.first() is not None


async def insert(
    session: AsyncSession,
    *,
    reservation_token: str,
    event_id: int,
    ticket_id: int,
    user_id: str | None,
    user_email: str | None,
    expires_at: datetime,
) -> ReservationView:
    reservation = Reservation(
        reservation_token=reservation_token,
        event_id=event_id,
        ticket_id=ticket_id,
        user_id=user_id,
        user_email=user_email,
        expires_at=expires_at,
        status="ACTIVE",
    )
    session.add(reservation)
    await session.flush()
    view = await find_by_id_for_update(session, reservation.id)
    if view is None:
        raise RuntimeError("INSERT de reserva não retornou a linha criada")
    return view


async def update_status(session: AsyncSession, reservation_id: int, status: str) -> None:
    reservation = await session.get(Reservation, reservation_id)
    if reservation is not None:
        reservation.status = status


async def update_expires_at(session: AsyncSession, reservation_id: int, expires_at: datetime) -> bool:
    """Só atualiza se a reserva ainda estiver ACTIVE; devolve se atualizou."""
    reservation = await session.get(Reservation, reservation_id)
    if reservation is None or reservation.status != "ACTIVE":
        return False
    reservation.expires_at = expires_at
    return True


async def find_expired_active(session: AsyncSession, now: datetime) -> list[ReservationView]:
    result = await session.execute(
        _select_joined().where(Reservation.status == "ACTIVE", Reservation.expires_at < now).order_by(Reservation.expires_at)
    )
    return [_to_view(row) for row in result.all()]
