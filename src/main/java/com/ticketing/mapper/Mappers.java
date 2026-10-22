package com.ticketing.mapper;

import com.ticketing.domain.Event;
import com.ticketing.domain.Payment;
import com.ticketing.domain.Ticket;
import com.ticketing.dto.EventResponse;
import com.ticketing.dto.PaymentResponse;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.dto.SeatResponse;
import com.ticketing.repository.ReservationView;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Conversões domínio -> DTO. Datas do banco (UTC, sem fuso) saem em ISO-8601 com sufixo Z. */
public final class Mappers {

    private Mappers() {
    }

    public static String iso(LocalDateTime utc) {
        return utc == null ? null : utc.toInstant(ZoneOffset.UTC).toString();
    }

    public static EventResponse toEventResponse(Event event) {
        return new EventResponse(
                event.getId(),
                event.getName(),
                event.getDescription(),
                iso(event.getStartDateTime()),
                iso(event.getEndDateTime()),
                event.getLocation(),
                event.getTotalCapacity(),
                event.getAvailableTickets(),
                event.getPrice(),
                event.getStatus());
    }

    public static SeatResponse toSeatResponse(Ticket ticket) {
        return new SeatResponse(ticket.getId(), ticket.getSeatNumber(), ticket.getSection(), ticket.getRowNumber(),
                ticket.getStatus());
    }

    public static ReservationResponse toReservationResponse(ReservationView view, LocalDateTime now) {
        long remaining = Duration.between(now, view.expiresAt()).getSeconds();
        return new ReservationResponse(
                view.reservationToken(),
                view.eventId(),
                view.eventName(),
                view.seatNumber(),
                view.userEmail(),
                iso(view.expiresAt()),
                view.status(),
                (int) Math.max(0, remaining));
    }

    public static PaymentResponse toPaymentResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getPaymentId(),
                payment.getIdempotencyKey(),
                payment.getReservationId(),
                payment.getTicketId(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getStatus(),
                payment.getPaymentMethod(),
                payment.getTransactionId(),
                payment.getFailureReason(),
                iso(payment.getCompletedAt()),
                iso(payment.getCreatedAt()),
                iso(payment.getUpdatedAt()));
    }
}
