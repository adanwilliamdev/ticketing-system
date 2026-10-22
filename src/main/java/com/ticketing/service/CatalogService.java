package com.ticketing.service;

import com.ticketing.domain.Event;
import com.ticketing.domain.Ticket;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.TicketRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Consultas de catálogo: lista de eventos e mapa de assentos. */
@Service
public class CatalogService {

    private final EventRepository events;
    private final TicketRepository tickets;

    public CatalogService(EventRepository events, TicketRepository tickets) {
        this.events = events;
        this.tickets = tickets;
    }

    @Transactional(readOnly = true)
    public List<Event> listAvailableEvents() {
        return events.findAvailable();
    }

    @Transactional(readOnly = true)
    public Event getEvent(long eventId) {
        return events.findById(eventId).orElseThrow(() -> new ResourceNotFoundException("Event not found"));
    }

    @Transactional(readOnly = true)
    public List<Ticket> listSeats(long eventId) {
        getEvent(eventId);
        return tickets.findByEventIdOrderByIdAsc(eventId);
    }
}
