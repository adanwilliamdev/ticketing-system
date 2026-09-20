"""Mapeadores de domínio -> DTO de resposta. Equivalente às funções to*Response de dto.ts."""
from datetime import datetime, timezone

from app.models import Event, Payment, Ticket
from app.schemas import EventResponse, PaymentResponse, ReservationResponse, SeatResponse


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def to_event_response(event: Event) -> EventResponse:
    return EventResponse(
        id=event.id,
        name=event.name,
        description=event.description,
        startDateTime=_iso(event.start_date_time),
        endDateTime=_iso(event.end_date_time),
        location=event.location,
        totalCapacity=event.total_capacity,
        availableTickets=event.available_tickets,
        price=float(event.price),
        status=event.status,  # type: ignore[arg-type]
    )


def to_seat_response(ticket: Ticket) -> SeatResponse:
    return SeatResponse(
        id=ticket.id,
        seatNumber=ticket.seat_number,
        section=ticket.section,
        rowNumber=ticket.row_number,
        status=ticket.status,  # type: ignore[arg-type]
    )


def to_reservation_response(reservation, event_name: str, seat_number: str, now: datetime) -> ReservationResponse:
    # `now` e `reservation.expires_at` são ambos UTC *naive* (ver reservation_service._now()).
    remaining = int((reservation.expires_at - now).total_seconds())
    return ReservationResponse(
        reservationToken=reservation.reservation_token,
        eventId=reservation.event_id,
        eventName=event_name,
        seatNumber=seat_number,
        userEmail=reservation.user_email,
        expiresAt=_iso(reservation.expires_at),
        status=reservation.status,  # type: ignore[arg-type]
        timeRemainingSeconds=max(0, remaining),
    )


def to_payment_response(payment: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=payment.id,
        paymentId=payment.payment_id,
        idempotencyKey=payment.idempotency_key,
        reservationId=payment.reservation_id,
        ticketId=payment.ticket_id,
        amount=float(payment.amount),
        currency=payment.currency,
        status=payment.status,  # type: ignore[arg-type]
        paymentMethod=payment.payment_method,  # type: ignore[arg-type]
        transactionId=payment.transaction_id,
        failureReason=payment.failure_reason,
        completedAt=_iso(payment.completed_at) if payment.completed_at else None,
        createdAt=_iso(payment.created_at),
        updatedAt=_iso(payment.updated_at),
    )
