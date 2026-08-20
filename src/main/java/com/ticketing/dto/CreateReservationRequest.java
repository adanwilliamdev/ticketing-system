package com.ticketing.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateReservationRequest {
    @NotNull(message = "Event ID is required")
    private Long eventId;
    
    @NotNull(message = "Seat number is required")
    private String seatNumber;
    
    @Email(message = "Invalid email format")
    private String userEmail;
    
    private String userId;
}
