"""Equivalente a services/reservation-service.ts."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.errors import BusinessError, ResourceNotFoundError
from app.lock import LockOptions, RedisLockManager
from app.logging_config import log
from app.mappers import to_reservation_response
from app.repositories import events as events_repo
from app.repositories import reservations as reservations_repo
from app.repositories import tickets as tickets_repo
from app.repositories.reservations import ReservationView
from app.schemas import CreateReservationRequest, ReservationResponse
from app.token import generate_reservation_token

# Mesmos tempos do original (tryLock(wait, lease)).
CREATE_LOCK = LockOptions(wait_ms=5_000, lease_ms=10_000)
RELEASE_LOCK = LockOptions(wait_ms=5_000, lease_ms=5_000)
CONFIRM_EXTENSION_MINUTES = 5


def _now() -> datetime:
    """"Agora", em UTC, sem tzinfo. As colunas TIMESTAMP do Postgres são "sem fuso" e este
    sistema sempre grava/lê UTC nelas (mesma convenção do db.ts original) — manter os `datetime`
    da aplicação *naive* evita misturar aware/naive nas comparações e no driver asyncpg."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_reservation_expired(reservation: ReservationView, now: datetime) -> bool:
    """Equivale a `Reservation.isExpired()`: expirada quando "agora" está estritamente depois de expiresAt."""
    return now > reservation.expires_at


async def release_active_reservation(session: AsyncSession, reservation: ReservationView) -> bool:
    """Devolve o assento e a vaga do evento e cancela a reserva — se ela ainda estiver ACTIVE.

    Deve rodar dentro de uma transação. Ordem fixa de locks (evento -> assento -> reserva), a mesma
    usada em create_reservation e no pagamento, para que transações concorrentes nunca se travem em
    ciclo. A reserva é relida já com lock: quem chamou pode ter uma versão desatualizada (ex.: um
    pagamento concluiu enquanto o job de expiração esperava).
    """
    await events_repo.find_by_id_for_update(session, reservation.event_id)
    await tickets_repo.find_by_id_for_update(session, reservation.ticket_id)
    current = await reservations_repo.find_by_id_for_update(session, reservation.id)
    if current is None or current.status != "ACTIVE":
        return False

    await tickets_repo.update_status(session, reservation.ticket_id, "AVAILABLE")
    await events_repo.increment_available(session, reservation.event_id)
    await reservations_repo.update_status(session, reservation.id, "CANCELLED")
    return True


class ReservationService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        locks: RedisLockManager,
        reservation_timeout_minutes: int,
    ) -> None:
        self._session_factory = session_factory
        self._locks = locks
        self._timeout_minutes = reservation_timeout_minutes

    async def get_reservation_by_token(self, token: str) -> ReservationView:
        async with self._session_factory() as session:
            reservation = await reservations_repo.find_by_token(session, token)
        if reservation is None:
            raise ResourceNotFoundError("Reservation not found")
        return reservation

    async def create_reservation(self, request: CreateReservationRequest) -> ReservationResponse:
        lock_key = f"event:{request.eventId}:ticket:{request.seatNumber}"

        async def do_create() -> ReservationResponse:
            async with self._session_factory() as session:
                async with session.begin():
                    event = await events_repo.find_by_id_for_update(session, request.eventId)
                    if event is None:
                        raise ResourceNotFoundError("Event not found")
                    if event.available_tickets <= 0:
                        raise BusinessError("No tickets available for this event")

                    ticket = await tickets_repo.find_by_event_and_seat_for_update(session, request.eventId, request.seatNumber)
                    if ticket is None:
                        raise ResourceNotFoundError("Seat not found")
                    if ticket.status != "AVAILABLE":
                        raise BusinessError("Seat is not available")

                    if await reservations_repo.exists_active_for_ticket(session, ticket.id):
                        raise BusinessError("Seat already has an active reservation")

                    now = _now()
                    await tickets_repo.update_status(session, ticket.id, "RESERVED")
                    await events_repo.decrement_available(session, event.id)
                    reservation = await reservations_repo.insert(
                        session,
                        reservation_token=generate_reservation_token(),
                        event_id=event.id,
                        ticket_id=ticket.id,
                        user_id=request.userId,
                        user_email=request.userEmail,
                        expires_at=now + timedelta(minutes=self._timeout_minutes),
                    )
                    log.info("Reservation created successfully: %s", reservation.reservation_token)
                    return to_reservation_response(reservation, reservation.event_name, reservation.seat_number, now)

        # Ordem: lock distribuído -> transação -> COMMIT -> libera o lock.
        result = await self._locks.try_with_lock(lock_key, CREATE_LOCK, do_create)
        if not result.acquired:
            raise BusinessError("Could not acquire lock for seat reservation")
        assert result.value is not None
        return result.value

    async def release_reservation(self, token: str) -> None:
        reservation = await self.get_reservation_by_token(token)

        async def do_release() -> bool:
            async with self._session_factory() as session:
                async with session.begin():
                    return await release_active_reservation(session, reservation)

        result = await self._locks.try_with_lock(f"reservation:{token}", RELEASE_LOCK, do_release)
        # Igual ao original: não conseguir o lock não é erro (quem o segura está mexendo na reserva).
        if not result.acquired:
            log.warning("Reservation %s not released: lock busy", token)
        elif result.value:
            log.info("Reservation released: %s", token)

    async def expire_reservations(self) -> int:
        async with self._session_factory() as session:
            expired = await reservations_repo.find_expired_active(session, _now())
        log.info("Found %d expired reservations to process", len(expired))

        released = 0
        for reservation in expired:
            try:
                await self.release_reservation(reservation.reservation_token)
                released += 1
            except Exception as error:  # noqa: BLE001
                log.error("Error processing expired reservation: %s (%s)", reservation.reservation_token, error)
        return released

    async def confirm_reservation(self, token: str) -> ReservationResponse:
        reservation = await self.get_reservation_by_token(token)
        now = _now()

        if reservation.status != "ACTIVE":
            raise BusinessError("Reservation is not active")
        if is_reservation_expired(reservation, now):
            raise BusinessError("Reservation has expired")

        # Comportamento herdado: a nova expiração é "agora + 5 min" (pode até ser menor que a atual).
        expires_at = now + timedelta(minutes=CONFIRM_EXTENSION_MINUTES)
        async with self._session_factory() as session:
            async with session.begin():
                updated = await reservations_repo.update_expires_at(session, reservation.id, expires_at)
        if not updated:
            raise BusinessError("Reservation is not active")

        reservation.expires_at = expires_at
        return to_reservation_response(reservation, reservation.event_name, reservation.seat_number, now)

    async def get_reservation_response_by_token(self, token: str) -> ReservationResponse:
        reservation = await self.get_reservation_by_token(token)
        return to_reservation_response(reservation, reservation.event_name, reservation.seat_number, _now())

    async def is_reservation_valid(self, token: str) -> bool:
        try:
            reservation = await self.get_reservation_by_token(token)
        except ResourceNotFoundError:
            return False
        return reservation.status == "ACTIVE" and not is_reservation_expired(reservation, _now())
