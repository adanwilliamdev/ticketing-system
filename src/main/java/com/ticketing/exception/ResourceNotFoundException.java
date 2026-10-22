package com.ticketing.exception;

/** Recurso inexistente (HTTP 404). */
public class ResourceNotFoundException extends TicketingException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
