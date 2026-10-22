package com.ticketing.exception;

/** Regra de negócio violada (HTTP 400). */
public class BusinessException extends TicketingException {

    public BusinessException(String message) {
        super(message);
    }
}
