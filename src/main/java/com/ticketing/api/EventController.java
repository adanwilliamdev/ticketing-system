package com.ticketing.api;

import com.ticketing.dto.EventResponse;
import com.ticketing.dto.SeatResponse;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.mapper.Mappers;
import com.ticketing.service.CatalogService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final CatalogService catalog;

    public EventController(CatalogService catalog) {
        this.catalog = catalog;
    }

    /** Eventos publicados com ingressos disponíveis. */
    @GetMapping
    public List<EventResponse> listEvents() {
        return catalog.listAvailableEvents().stream().map(Mappers::toEventResponse).toList();
    }

    @GetMapping("/{id}")
    public EventResponse getEvent(@PathVariable("id") long id) {
        requirePositive(id);
        return Mappers.toEventResponse(catalog.getEvent(id));
    }

    /** Mapa de assentos com o status atual de cada um. */
    @GetMapping("/{id}/seats")
    public List<SeatResponse> listSeats(@PathVariable("id") long id) {
        requirePositive(id);
        return catalog.listSeats(id).stream().map(Mappers::toSeatResponse).toList();
    }

    private static void requirePositive(long id) {
        if (id <= 0) {
            throw new ResourceNotFoundException("Event not found");
        }
    }
}
