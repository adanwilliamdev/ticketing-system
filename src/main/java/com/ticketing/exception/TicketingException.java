package com.ticketing.exception;

/** Base das exceções de domínio. */
public abstract class TicketingException extends RuntimeException {

    protected TicketingException(String message) {
        super(message);
    }
}
