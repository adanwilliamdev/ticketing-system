package com.ticketing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationResponse {
    private String reservationToken;
    private Long eventId;
    private String eventName;
    private String seatNumber;
    private String userEmail;
    private LocalDateTime expiresAt;
    private String status;
    private Long timeRemainingSeconds;
}
