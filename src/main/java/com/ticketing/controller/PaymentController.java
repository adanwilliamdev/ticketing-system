package com.ticketing.controller;

import com.ticketing.dto.PaymentRequest;
import com.ticketing.entity.Payment;
import com.ticketing.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payments")
@Slf4j
@RequiredArgsConstructor
public class PaymentController {
    
    private final PaymentService paymentService;
    
    @PostMapping
    public ResponseEntity<Payment> processPayment(@Valid @RequestBody PaymentRequest request) {
        log.info("Processing payment with idempotency key: {}", request.getIdempotencyKey());
        
        Payment payment = paymentService.processPayment(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(payment);
    }
    
    @GetMapping("/idempotency/{key}")
    public ResponseEntity<Payment> getPaymentByIdempotencyKey(@PathVariable String key) {
        log.info("Getting payment by idempotency key: {}", key);
        
        Payment payment = paymentService.getPaymentByIdempotencyKey(key);
        return ResponseEntity.ok(payment);
    }
    
    @GetMapping("/reservation/{token}")
    public ResponseEntity<Payment> getPaymentByReservationToken(@PathVariable String token) {
        log.info("Getting payment by reservation token: {}", token);
        
        Payment payment = paymentService.getPaymentByReservationToken(token);
        return ResponseEntity.ok(payment);
    }
}
