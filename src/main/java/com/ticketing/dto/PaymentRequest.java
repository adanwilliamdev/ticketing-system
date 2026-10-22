package com.ticketing.dto;

import com.ticketing.domain.PaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Dados de cartão nunca são aceitos, persistidos nem registrados em log por este serviço
 * (o gateway é simulado); campos extras enviados pelo cliente são descartados.
 */
public record PaymentRequest(
        @NotBlank(message = "Reservation token is required") @Size(max = 64, message = "Reservation token must have at most 64 characters") String reservationToken,
        @NotNull(message = "Payment method is required") PaymentMethod paymentMethod,
        @NotBlank(message = "Idempotency key is required") @Size(max = 255, message = "Idempotency key must have at most 255 characters") String idempotencyKey) {
}
