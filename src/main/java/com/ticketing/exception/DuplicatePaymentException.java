package com.ticketing.exception;

public class DuplicatePaymentException extends RuntimeException {
    public DuplicatePaymentException(String message) {
        super(message);
    }
    
    public DuplicatePaymentException(String message, Throwable cause) {
        super(message, cause);
    }
}
