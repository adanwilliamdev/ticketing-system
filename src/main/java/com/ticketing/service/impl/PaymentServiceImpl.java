package com.ticketing.service.impl;

import com.ticketing.dto.PaymentRequest;
import com.ticketing.entity.Payment;
import com.ticketing.entity.Reservation;
import com.ticketing.entity.Ticket;
import com.ticketing.entity.Ticket.TicketStatus;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.DuplicatePaymentException;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.repository.PaymentRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.service.PaymentService;
import com.ticketing.service.ReservationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {
    
    private final PaymentRepository paymentRepository;
    private final ReservationRepository reservationRepository;
    private final ReservationService reservationService;
    private final RedissonClient redissonClient;
    
    @Value("${ticketing.payment.idempotency-key-ttl}")
    private long idempotencyKeyTTL;
    
    @Override
    @Transactional
    public Payment processPayment(PaymentRequest request) {
        String lockKey = "payment:" + request.getIdempotencyKey();
        RLock lock = redissonClient.getLock(lockKey);
        
        try {
            if (lock.tryLock(10, 15, TimeUnit.SECONDS)) {
                try {
                    // Check idempotency
                    Payment existingPayment = paymentRepository
                        .findByIdempotencyKey(request.getIdempotencyKey())
                        .orElse(null);
                    
                    if (existingPayment != null) {
                        log.warn("Duplicate payment attempt detected: {}", request.getIdempotencyKey());
                        throw new DuplicatePaymentException("Payment already processed");
                    }
                    
                    // Validate reservation
                    if (!reservationService.isReservationValid(request.getReservationToken())) {
                        throw new BusinessException("Invalid or expired reservation");
                    }
                    
                    Reservation reservation = reservationService
                        .getReservationByToken(request.getReservationToken());
                    
                    // Lock reservation
                    String reservationLockKey = "reservation:" + request.getReservationToken();
                    RLock reservationLock = redissonClient.getLock(reservationLockKey);
                    
                    try {
                        if (reservationLock.tryLock(5, 10, TimeUnit.SECONDS)) {
                            try {
                                // Process payment
                                Payment payment = Payment.builder()
                                    .paymentId(UUID.randomUUID().toString())
                                    .idempotencyKey(request.getIdempotencyKey())
                                    .reservation(reservation)
                                    .ticket(reservation.getTicket())
                                    .amount(reservation.getEvent().getPrice())
                                    .currency("BRL")
                                    .status(Payment.PaymentStatus.PROCESSING)
                                    .paymentMethod(request.getPaymentMethod())
                                    .build();
                                
                                // Simulate payment processing
                                try {
                                    // In real implementation, this would call external payment gateway
                                    processPaymentWithGateway(payment, request);
                                    
                                    // Update payment status
                                    payment.setStatus(Payment.PaymentStatus.COMPLETED);
                                    payment.setCompletedAt(LocalDateTime.now());
                                    
                                    // Update ticket status
                                    Ticket ticket = reservation.getTicket();
                                    ticket.setStatus(TicketStatus.SOLD);
                                    
                                    // Update reservation
                                    reservation.setStatus(Reservation.ReservationStatus.COMPLETED);
                                    
                                    payment = paymentRepository.save(payment);
                                    log.info("Payment processed successfully: {}", payment.getId());
                                    
                                    return payment;
                                    
                                } catch (Exception e) {
                                    log.error("Payment processing failed", e);
                                    payment.setStatus(Payment.PaymentStatus.FAILED);
                                    payment.setFailureReason(e.getMessage());
                                    payment = paymentRepository.save(payment);
                                    
                                    // Release reservation
                                    reservationService.releaseReservation(
                                        reservation.getReservationToken()
                                    );
                                    
                                    throw new BusinessException("Payment processing failed: " + e.getMessage());
                                }
                                
                            } finally {
                                if (reservationLock.isHeldByCurrentThread()) {
                                    reservationLock.unlock();
                                }
                            }
                        } else {
                            throw new BusinessException("Could not acquire lock for reservation");
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new BusinessException("Payment process interrupted");
                    }
                    
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            } else {
                throw new BusinessException("Could not acquire lock for payment processing");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("Payment process interrupted");
        }
    }
    
    protected void processPaymentWithGateway(Payment payment, PaymentRequest request) {
        // Simula processamento de pagamento externo
        // Em produção, chamaria API do gateway de pagamento
        try {
            Thread.sleep(2000); // Simula delay do gateway
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("Payment gateway timeout");
        }
    }
    
    @Override
    public Payment getPaymentByIdempotencyKey(String idempotencyKey) {
        return paymentRepository.findByIdempotencyKey(idempotencyKey)
            .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
    }
    
    @Override
    public Payment getPaymentByReservationToken(String token) {
        Reservation reservation = reservationService.getReservationByToken(token);
        return paymentRepository.findByReservationId(reservation.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
    }
    
    @Override
    @Transactional
    public void refundPayment(String paymentId) {
        // Implementar lógica de reembolso
        log.info("Processing refund for payment: {}", paymentId);
    }
}
