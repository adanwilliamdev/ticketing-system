"""Equivalente a repositories/payments.ts."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import DuplicatePaymentError
from app.models import Payment


async def find_by_idempotency_key(session: AsyncSession, key: str) -> Payment | None:
    result = await session.execute(select(Payment).where(Payment.idempotency_key == key))
    return result.scalar_one_or_none()


async def find_by_reservation_id(session: AsyncSession, reservation_id: int) -> Payment | None:
    result = await session.execute(select(Payment).where(Payment.reservation_id == reservation_id))
    return result.scalar_one_or_none()


async def insert(
    session: AsyncSession,
    *,
    payment_id: str,
    idempotency_key: str,
    reservation_id: int,
    ticket_id: int,
    amount: str,
    currency: str,
    status: str,
    payment_method: str,
    transaction_id: str | None,
    failure_reason: str | None,
    completed_at: datetime | None,
) -> Payment:
    payment = Payment(
        payment_id=payment_id,
        idempotency_key=idempotency_key,
        reservation_id=reservation_id,
        ticket_id=ticket_id,
        amount=amount,
        currency=currency,
        status=status,
        payment_method=payment_method,
        transaction_id=transaction_id,
        failure_reason=failure_reason,
        completed_at=completed_at,
    )
    session.add(payment)
    try:
        await session.flush()
    except IntegrityError as error:
        # Última barreira de idempotência: duas requisições com a mesma chave que passem pelo lock.
        await session.rollback()
        if "idempotency_key" in str(error.orig):
            raise DuplicatePaymentError("Payment already processed") from error
        raise
    return payment
