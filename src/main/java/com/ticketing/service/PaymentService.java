package com.ticketing.service;

import com.ticketing.dto.PaymentRequest;
import com.ticketing.entity.Payment;

public interface PaymentService {
    Payment processPayment(PaymentRequest request);
    Payment getPaymentByIdempotencyKey(String idempotencyKey);
    Payment getPaymentByReservationToken(String token);
    void refundPayment(String paymentId);
}
