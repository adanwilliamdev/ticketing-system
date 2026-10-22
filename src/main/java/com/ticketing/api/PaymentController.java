package com.ticketing.api;

import com.ticketing.dto.PaymentRequest;
import com.ticketing.dto.PaymentResponse;
import com.ticketing.mapper.Mappers;
import com.ticketing.service.PaymentService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentResponse process(@Valid @RequestBody PaymentRequest body) {
        log.info("Processing payment with idempotency key: {}", body.idempotencyKey());
        return Mappers.toPaymentResponse(payments.processPayment(body));
    }

    @GetMapping("/idempotency/{key}")
    public PaymentResponse getByIdempotencyKey(@PathVariable("key") String key) {
        return Mappers.toPaymentResponse(payments.getPaymentByIdempotencyKey(key));
    }

    @GetMapping("/reservation/{token}")
    public PaymentResponse getByReservation(@PathVariable("token") String token) {
        return Mappers.toPaymentResponse(payments.getPaymentByReservationToken(token));
    }
}
