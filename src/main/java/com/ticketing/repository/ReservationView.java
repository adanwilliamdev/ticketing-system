package com.ticketing.repository;

import com.ticketing.domain.ReservationStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Reserva "achatada" com nome/preço do evento e número do assento (evita N+1). */
public record ReservationView(
        Long id,
        String reservationToken,
        Long eventId,
        Long ticketId,
        String userId,
        String userEmail,
        LocalDateTime expiresAt,
        ReservationStatus status,
        String eventName,
        BigDecimal eventPrice,
        String seatNumber) {

    /** Expirada quando "agora" está estritamente depois de expiresAt. */
    public boolean isExpired(LocalDateTime now) {
        return now.isAfter(expiresAt);
    }

    public ReservationView withExpiresAt(LocalDateTime newExpiresAt) {
        return new ReservationView(id, reservationToken, eventId, ticketId, userId, userEmail, newExpiresAt, status,
                eventName, eventPrice, seatNumber);
    }
}
