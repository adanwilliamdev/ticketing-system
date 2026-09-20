"""Equivalente a app/api/payments/**/route.ts."""
from fastapi import APIRouter, Request

from app.logging_config import log
from app.mappers import to_payment_response
from app.schemas import PaymentRequest, PaymentResponse

router = APIRouter(prefix="/api/payments", tags=["payments"])


# POST /api/payments — processar pagamento
@router.post("", response_model=PaymentResponse, status_code=201)
async def process_payment(body: PaymentRequest, request: Request) -> PaymentResponse:
    log.info("Processing payment with idempotency key: %s", body.idempotencyKey)
    payment = await request.app.state.container.payments.process_payment(body)
    return to_payment_response(payment)


# GET /api/payments/idempotency/{key}
@router.get("/idempotency/{key}", response_model=PaymentResponse)
async def get_payment_by_key(key: str, request: Request) -> PaymentResponse:
    payment = await request.app.state.container.payments.get_payment_by_idempotency_key(key)
    return to_payment_response(payment)


# GET /api/payments/reservation/{token}
@router.get("/reservation/{token}", response_model=PaymentResponse)
async def get_payment_by_reservation(token: str, request: Request) -> PaymentResponse:
    payment = await request.app.state.container.payments.get_payment_by_reservation_token(token)
    return to_payment_response(payment)
