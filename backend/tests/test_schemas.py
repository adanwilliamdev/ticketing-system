import pytest
from pydantic import ValidationError

from app.schemas import CreateReservationRequest, PaymentRequest


def test_create_reservation_requires_event_id_and_seat():
    with pytest.raises(ValidationError):
        CreateReservationRequest(eventId=0, seatNumber="")


def test_create_reservation_accepts_minimal_payload():
    req = CreateReservationRequest(eventId=1, seatNumber="A001", userEmail=None, userId=None)
    assert req.eventId == 1
    assert req.seatNumber == "A001"


def test_payment_request_rejects_unknown_method():
    with pytest.raises(ValidationError):
        PaymentRequest(reservationToken="tok", paymentMethod="CASH", idempotencyKey="k")


def test_payment_request_accepts_valid_method():
    req = PaymentRequest(reservationToken="tok", paymentMethod="PIX", idempotencyKey="k")
    assert req.paymentMethod == "PIX"
