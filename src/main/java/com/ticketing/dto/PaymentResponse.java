package com.ticketing.dto;

import com.ticketing.domain.PaymentMethod;
import com.ticketing.domain.PaymentStatus;
import java.math.BigDecimal;

public record PaymentResponse(
        Long id,
        String paymentId,
        String idempotencyKey,
        Long reservationId,
        Long ticketId,
        BigDecimal amount,
        String currency,
        PaymentStatus status,
        PaymentMethod paymentMethod,
        String transactionId,
        String failureReason,
        String completedAt,
        String createdAt,
        String updatedAt) {
}
