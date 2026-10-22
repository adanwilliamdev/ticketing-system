package com.ticketing.exception;

/** Chave de idempotência já utilizada (HTTP 409). */
public class DuplicatePaymentException extends TicketingException {

    public DuplicatePaymentException(String message) {
        super(message);
    }
}
