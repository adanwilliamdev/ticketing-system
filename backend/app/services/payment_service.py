"""Equivalente a services/payment-service.ts."""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.errors import BusinessError, DuplicatePaymentError, ResourceNotFoundError
from app.lock import LockOptions, RedisLockManager
from app.logging_config import log
from app.models import Payment
from app.payment_gateway import GatewayCharge, PaymentGateway
from app.repositories import payments as payments_repo
from app.repositories import reservations as reservations_repo
from app.repositories import tickets as tickets_repo
from app.repositories.reservations import ReservationView
from app.schemas import PaymentRequest
from app.services.reservation_service import ReservationService, is_reservation_expired, release_active_reservation

PAYMENT_LOCK = LockOptions(wait_ms=10_000, lease_ms=15_000)
RESERVATION_LOCK = LockOptions(wait_ms=5_000, lease_ms=10_000)
CURRENCY = "BRL"


def _now() -> datetime:
    """Ver reservation_service._now(): UTC *naive*, para casar com as colunas TIMESTAMP do Postgres."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PaymentService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        reservations: ReservationService,
        locks: RedisLockManager,
        gateway: PaymentGateway,
        generate_id,
    ) -> None:
        self._session_factory = session_factory
        self._reservations = reservations
        self._locks = locks
        self._gateway = gateway
        self._generate_id = generate_id

    async def process_payment(self, request: PaymentRequest) -> Payment:
        async def outer() -> Payment:
            # 1. Idempotência: a chave já foi usada?
            async with self._session_factory() as session:
                existing = await payments_repo.find_by_idempotency_key(session, request.idempotencyKey)
            if existing:
                log.warning("Duplicate payment attempt detected: %s", request.idempotencyKey)
                raise DuplicatePaymentError("Payment already processed")

            # 2. A reserva existe, está ativa e não expirou?
            if not await self._reservations.is_reservation_valid(request.reservationToken):
                raise BusinessError("Invalid or expired reservation")
            reservation = await self._reservations.get_reservation_by_token(request.reservationToken)

            # 3. Exclusão mútua sobre a reserva (job de expiração, cancelamento e outros pagamentos).
            inner = await self._locks.try_with_lock(
                f"reservation:{request.reservationToken}",
                RESERVATION_LOCK,
                lambda: self._charge_and_settle(reservation, request),
            )
            if not inner.acquired:
                raise BusinessError("Could not acquire lock for reservation")
            assert inner.value is not None
            return inner.value

        result = await self._locks.try_with_lock(f"payment:{request.idempotencyKey}", PAYMENT_LOCK, outer)
        if not result.acquired:
            raise BusinessError("Could not acquire lock for payment processing")
        assert result.value is not None
        return result.value

    async def _charge_and_settle(self, stale: ReservationView, request: PaymentRequest) -> Payment:
        # Releitura já com o lock da reserva: entre a validação e a aquisição do lock, outro
        # pagamento pode ter concluído (ou o job de expiração ter cancelado). Sem isso, cobraríamos
        # duas vezes.
        reservation = await self._reservations.get_reservation_by_token(stale.reservation_token)
        if reservation.status != "ACTIVE" or is_reservation_expired(reservation, _now()):
            raise BusinessError("Invalid or expired reservation")

        payment_id = self._generate_id()
        amount = reservation.event_price

        # A chamada ao gateway fica FORA de qualquer transação: não segura conexão nem locks de
        # linha enquanto espera um serviço externo.
        try:
            await self._gateway.charge(
                GatewayCharge(
                    payment_id=payment_id,
                    amount=amount,
                    currency=CURRENCY,
                    method=request.paymentMethod,
                    reservation_token=reservation.reservation_token,
                )
            )
        except Exception as error:  # noqa: BLE001
            log.error("Payment processing failed: %s", error)
            message = str(error)

            # Registra o pagamento como FAILED e devolve o assento — na MESMA transação, e
            # commitada antes de o erro subir.
            async with self._session_factory() as session:
                async with session.begin():
                    await release_active_reservation(session, reservation)
                    await payments_repo.insert(
                        session,
                        payment_id=payment_id,
                        idempotency_key=request.idempotencyKey,
                        reservation_id=reservation.id,
                        ticket_id=reservation.ticket_id,
                        amount=amount,
                        currency=CURRENCY,
                        status="FAILED",
                        payment_method=request.paymentMethod,
                        transaction_id=None,
                        failure_reason=message,
                        completed_at=None,
                    )
            raise BusinessError(f"Payment processing failed: {message}") from error

        async with self._session_factory() as session:
            async with session.begin():
                # Ordem de locks: assento -> reserva (subsequência de evento -> assento -> reserva).
                await tickets_repo.find_by_id_for_update(session, reservation.ticket_id)
                current = await reservations_repo.find_by_id_for_update(session, reservation.id)
                if current is None or current.status != "ACTIVE":
                    # Só acontece se o lease do lock expirou durante a cobrança. A cobrança já
                    # ocorreu: vale alarme para reconciliação/estorno manual.
                    log.error(
                        "Reservation %s no longer active after charge %s; manual refund may be required",
                        reservation.reservation_token,
                        payment_id,
                    )
                    raise BusinessError("Reservation is no longer active")

                payment = await payments_repo.insert(
                    session,
                    payment_id=payment_id,
                    idempotency_key=request.idempotencyKey,
                    reservation_id=reservation.id,
                    ticket_id=reservation.ticket_id,
                    amount=amount,
                    currency=CURRENCY,
                    status="COMPLETED",
                    payment_method=request.paymentMethod,
                    transaction_id=None,
                    failure_reason=None,
                    completed_at=_now(),
                )
                await tickets_repo.update_status(session, reservation.ticket_id, "SOLD")
                await reservations_repo.update_status(session, reservation.id, "COMPLETED")

                log.info("Payment processed successfully: %s", payment.id)
                return payment

    async def get_payment_by_idempotency_key(self, idempotency_key: str) -> Payment:
        async with self._session_factory() as session:
            payment = await payments_repo.find_by_idempotency_key(session, idempotency_key)
        if payment is None:
            raise ResourceNotFoundError("Payment not found")
        return payment

    async def get_payment_by_reservation_token(self, token: str) -> Payment:
        reservation = await self._reservations.get_reservation_by_token(token)
        async with self._session_factory() as session:
            payment = await payments_repo.find_by_reservation_id(session, reservation.id)
        if payment is None:
            raise ResourceNotFoundError("Payment not found")
        return payment

    async def refund_payment(self, payment_id: str) -> None:
        # TODO: no projeto original este método também era apenas um stub (só registrava em log).
        log.info("Processing refund for payment: %s", payment_id)
