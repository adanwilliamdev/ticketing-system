"""Equivalente a app/api/events/**/route.ts."""
from fastapi import APIRouter, Request

from app.errors import ResourceNotFoundError
from app.mappers import to_event_response, to_seat_response
from app.schemas import EventResponse, SeatResponse

router = APIRouter(prefix="/api/events", tags=["events"])


# GET /api/events — eventos publicados com ingressos disponíveis
@router.get("", response_model=list[EventResponse])
async def list_events(request: Request) -> list[EventResponse]:
    events = await request.app.state.container.catalog.list_available_events()
    return [to_event_response(e) for e in events]


# GET /api/events/{id}
@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: int, request: Request) -> EventResponse:
    if event_id <= 0:
        raise ResourceNotFoundError("Event not found")
    event = await request.app.state.container.catalog.get_event(event_id)
    return to_event_response(event)


# GET /api/events/{id}/seats — mapa de assentos com o status atual de cada um
@router.get("/{event_id}/seats", response_model=list[SeatResponse])
async def list_seats(event_id: int, request: Request) -> list[SeatResponse]:
    if event_id <= 0:
        raise ResourceNotFoundError("Event not found")
    seats = await request.app.state.container.catalog.list_seats(event_id)
    return [to_seat_response(s) for s in seats]
