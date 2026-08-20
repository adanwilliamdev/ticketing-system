package com.ticketing.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.ticketing.entity.Payment.PaymentMethod;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequest {
    @NotNull(message = "Reservation token is required")
    private String reservationToken;
    
    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;
    
    private String cardNumber;
    private String cardExpiry;
    private String cardCvv;
    private String cardHolderName;
    
    @NotNull(message = "Idempotency key is required")
    private String idempotencyKey;
}
