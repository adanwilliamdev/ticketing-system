package com.ticketing.api;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.ticketing.dto.ErrorBody;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.DuplicatePaymentException;
import com.ticketing.exception.ResourceNotFoundException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Respostas de erro padronizadas da API: {timestamp, status, error, message, details?}. */
@RestControllerAdvice(basePackages = "com.ticketing.api")
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorBody> notFound(ResourceNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return body(HttpStatus.NOT_FOUND, ex.getMessage(), null);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorBody> business(BusinessException ex) {
        log.warn("Business error: {}", ex.getMessage());
        return body(HttpStatus.BAD_REQUEST, ex.getMessage(), null);
    }

    @ExceptionHandler(DuplicatePaymentException.class)
    public ResponseEntity<ErrorBody> duplicatePayment(DuplicatePaymentException ex) {
        log.warn("Duplicate payment: {}", ex.getMessage());
        return body(HttpStatus.CONFLICT, ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorBody> invalidBody(MethodArgumentNotValidException ex) {
        Map<String, String> details = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            details.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return body(HttpStatus.BAD_REQUEST, "Validation failed", details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorBody> unreadable(HttpMessageNotReadableException ex) {
        String field = "body";
        String message = "Malformed JSON request";
        if (ex.getCause() instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
            field = mapping.getPath().get(mapping.getPath().size() - 1).getFieldName();
            message = "Invalid value";
        }
        return body(HttpStatus.BAD_REQUEST, "Validation failed", Map.of(String.valueOf(field), message));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorBody> typeMismatch(MethodArgumentTypeMismatchException ex) {
        return body(HttpStatus.BAD_REQUEST, "Validation failed", Map.of(ex.getName(), "Invalid value"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorBody> unexpected(Exception ex) {
        // Exceções do próprio Spring MVC (405, 415, ...) já carregam o status correto.
        if (ex instanceof ErrorResponse errorResponse) {
            HttpStatusCode status = errorResponse.getStatusCode();
            return body(status, HttpStatus.valueOf(status.value()).getReasonPhrase(), null);
        }
        log.error("Unexpected error", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", null);
    }

    private static ResponseEntity<ErrorBody> body(HttpStatusCode status, String message, Map<String, String> details) {
        String reason = HttpStatus.valueOf(status.value()).getReasonPhrase();
        ErrorBody error = new ErrorBody(Instant.now().toString(), status.value(), reason, message,
                details == null || details.isEmpty() ? null : details);
        return ResponseEntity.status(status).body(error);
    }
}
