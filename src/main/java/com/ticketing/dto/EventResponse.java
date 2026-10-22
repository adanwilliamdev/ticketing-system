package com.ticketing.dto;

import com.ticketing.domain.EventCategory;
import com.ticketing.domain.EventStatus;
import java.math.BigDecimal;

public record EventResponse(
        Long id,
        String name,
        String description,
        String startDateTime,
        String endDateTime,
        String location,
        int totalCapacity,
        int availableTickets,
        BigDecimal price,
        EventStatus status,
        EventCategory category,
        String imageUrl) {
}