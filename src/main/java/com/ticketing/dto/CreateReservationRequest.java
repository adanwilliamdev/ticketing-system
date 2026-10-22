package com.ticketing.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateReservationRequest(
        @NotNull(message = "Event ID is required") @Positive(message = "Event ID must be positive") Long eventId,
        @NotBlank(message = "Seat number is required") @Size(max = 50, message = "Seat number must have at most 50 characters") String seatNumber,
        @Email(message = "Invalid email") @Size(max = 255, message = "Email must have at most 255 characters") String userEmail,
        @Size(max = 100, message = "User ID must have at most 100 characters") String userId) {
}
