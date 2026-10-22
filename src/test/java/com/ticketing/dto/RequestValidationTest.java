package com.ticketing.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.ticketing.domain.PaymentMethod;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class RequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createReservationRequiresEventIdAndSeat() {
        var violations = validator.validate(new CreateReservationRequest(0L, "", null, null));

        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("eventId")));
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("seatNumber")));
    }

    @Test
    void createReservationRejectsBlankSeat() {
        assertFalse(validator.validate(new CreateReservationRequest(1L, "   ", null, null)).isEmpty());
    }

    @Test
    void createReservationAcceptsMinimalPayload() {
        assertTrue(validator.validate(new CreateReservationRequest(1L, "A001", null, null)).isEmpty());
    }

    @Test
    void createReservationRejectsInvalidEmail() {
        var violations = validator.validate(new CreateReservationRequest(1L, "A001", "not-an-email", null));

        assertEquals(1, violations.size());
        assertEquals("userEmail", violations.iterator().next().getPropertyPath().toString());
    }

    @Test
    void paymentRequestRequiresAllFields() {
        assertEquals(3, validator.validate(new PaymentRequest("", null, " ")).size());
    }

    @Test
    void paymentRequestAcceptsValidPayload() {
        assertTrue(validator.validate(new PaymentRequest("tok", PaymentMethod.PIX, "key")).isEmpty());
    }
}
