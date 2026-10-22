package com.ticketing.dto;

import com.ticketing.domain.ReservationStatus;

public record ReservationResponse(
        String reservationToken,
        Long eventId,
        String eventName,
        String seatNumber,
        String userEmail,
        String expiresAt,
        ReservationStatus status,
        int timeRemainingSeconds) {
}
