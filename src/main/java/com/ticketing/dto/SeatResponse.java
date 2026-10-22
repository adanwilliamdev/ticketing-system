package com.ticketing.dto;

import com.ticketing.domain.TicketStatus;

public record SeatResponse(Long id, String seatNumber, String section, String rowNumber, TicketStatus status) {
}
