"""Equivalente a app/api/reservations/**/route.ts."""
from fastapi import APIRouter, Request, Response

from app.logging_config import log
from app.schemas import CreateReservationRequest, ReservationResponse

router = APIRouter(prefix="/api/reservations", tags=["reservations"])


# POST /api/reservations — criar reserva
@router.post("", response_model=ReservationResponse, status_code=201)
async def create_reservation(body: CreateReservationRequest, request: Request) -> ReservationResponse:
    log.info("Creating reservation for event: %s, seat: %s", body.eventId, body.seatNumber)
    return await request.app.state.container.reservations.create_reservation(body)


# GET /api/reservations/{token} — buscar reserva
@router.get("/{token}", response_model=ReservationResponse)
async def get_reservation(token: str, request: Request) -> ReservationResponse:
    return await request.app.state.container.reservations.get_reservation_response_by_token(token)


# DELETE /api/reservations/{token} — cancelar reserva
@router.delete("/{token}", status_code=204)
async def cancel_reservation(token: str, request: Request) -> Response:
    await request.app.state.container.reservations.release_reservation(token)
    return Response(status_code=204)


# POST /api/reservations/{token}/confirm — confirmar reserva (estende o prazo para o pagamento)
@router.post("/{token}/confirm", response_model=ReservationResponse)
async def confirm_reservation(token: str, request: Request) -> ReservationResponse:
    return await request.app.state.container.reservations.confirm_reservation(token)


# GET /api/reservations/{token}/validate — corpo é um boolean, como no original
@router.get("/{token}/validate", response_model=bool)
async def validate_reservation(token: str, request: Request) -> bool:
    return await request.app.state.container.reservations.is_reservation_valid(token)
