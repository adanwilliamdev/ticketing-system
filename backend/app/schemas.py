"""Formas de resposta/entrada da API — equivalente a dto.ts + validation.ts."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

EventStatusT = Literal["DRAFT", "PUBLISHED", "ONGOING", "CANCELLED", "COMPLETED"]
TicketStatusT = Literal["AVAILABLE", "RESERVED", "SOLD", "CANCELLED"]
ReservationStatusT = Literal["ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"]
PaymentStatusT = Literal["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED"]
PaymentMethodT = Literal["CREDIT_CARD", "DEBIT_CARD", "PIX", "BOLETO", "PAYPAL"]

PAYMENT_METHODS: tuple[str, ...] = ("CREDIT_CARD", "DEBIT_CARD", "PIX", "BOLETO", "PAYPAL")


# ---- Respostas ----------------------------------------------------------

class EventResponse(BaseModel):
    id: int
    name: str
    description: str | None
    startDateTime: str
    endDateTime: str
    location: str | None
    totalCapacity: int
    availableTickets: int
    price: float
    status: EventStatusT


class SeatResponse(BaseModel):
    id: int
    seatNumber: str
    section: str | None
    rowNumber: str | None
    status: TicketStatusT


class ReservationResponse(BaseModel):
    reservationToken: str
    eventId: int
    eventName: str
    seatNumber: str
    userEmail: str | None
    expiresAt: str
    status: ReservationStatusT
    timeRemainingSeconds: int


class PaymentResponse(BaseModel):
    id: int
    paymentId: str | None
    idempotencyKey: str
    reservationId: int
    ticketId: int
    amount: float
    currency: str | None
    status: PaymentStatusT
    paymentMethod: PaymentMethodT | None
    transactionId: str | None
    failureReason: str | None
    completedAt: str | None
    createdAt: str
    updatedAt: str


class ErrorBody(BaseModel):
    timestamp: str
    status: int
    error: str
    message: str
    details: dict[str, str] | None = None


class HealthResponse(BaseModel):
    status: Literal["UP", "DOWN"]
    components: dict[str, Literal["UP", "DOWN"]]


# ---- Requisições (equivalente às validações de validation.ts) -----------

class CreateReservationRequest(BaseModel):
    eventId: int = Field(gt=0, description="Event ID is required")
    seatNumber: str = Field(min_length=1, max_length=50, description="Seat number is required")
    userEmail: EmailStr | None = Field(default=None, max_length=255)
    userId: str | None = Field(default=None, max_length=100)

    @field_validator("seatNumber")
    @classmethod
    def seat_number_not_blank(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("Seat number is required")
        return value


class PaymentRequest(BaseModel):
    reservationToken: str = Field(min_length=1, max_length=64, description="Reservation token is required")
    paymentMethod: PaymentMethodT
    idempotencyKey: str = Field(min_length=1, max_length=255, description="Idempotency key is required")
    # cardNumber, cardExpiry, cardCvv, cardHolderName eram aceitos e ignorados no projeto original
    # (o gateway é simulado). Dados de cartão nunca devem ser persistidos nem logados por este serviço,
    # então o schema nem os declara — o Pydantic os descarta silenciosamente se enviados.

    @field_validator("reservationToken")
    @classmethod
    def token_not_blank(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("Reservation token is required")
        return value
