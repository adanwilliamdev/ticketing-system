package com.ticketing.service;

import com.ticketing.domain.Payment;
import com.ticketing.domain.PaymentMethod;
import com.ticketing.domain.PaymentStatus;
import com.ticketing.domain.Reservation;
import com.ticketing.domain.ReservationStatus;
import com.ticketing.domain.Ticket;
import com.ticketing.domain.TicketStatus;
import com.ticketing.dto.PaymentRequest;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.DuplicatePaymentException;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.gateway.GatewayCharge;
import com.ticketing.gateway.PaymentGateway;
import com.ticketing.lock.LockOptions;
import com.ticketing.lock.LockResult;
import com.ticketing.lock.RedisLockManager;
import com.ticketing.repository.PaymentRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.repository.ReservationView;
import com.ticketing.repository.TicketRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Processamento de pagamentos com idempotência, exclusão mútua e cobrança fora de transação. */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    static final LockOptions PAYMENT_LOCK = new LockOptions(10_000, 15_000);
    static final LockOptions RESERVATION_LOCK = new LockOptions(5_000, 10_000);
    static final String CURRENCY = "BRL";

    private final ReservationService reservationService;
    private final ReservationRepository reservations;
    private final TicketRepository tickets;
    private final PaymentRepository payments;
    private final RedisLockManager locks;
    private final PaymentGateway gateway;
    private final TransactionTemplate tx;

    public PaymentService(ReservationService reservationService, ReservationRepository reservations,
                          TicketRepository tickets, PaymentRepository payments, RedisLockManager locks,
                          PaymentGateway gateway, PlatformTransactionManager transactionManager) {
        this.reservationService = reservationService;
        this.reservations = reservations;
        this.tickets = tickets;
        this.payments = payments;
        this.locks = locks;
        this.gateway = gateway;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public Payment processPayment(PaymentRequest request) {
        LockResult<Payment> result = locks.tryWithLock("payment:" + request.idempotencyKey(), PAYMENT_LOCK,
                () -> processLocked(request));
        if (!result.acquired()) {
            throw new BusinessException("Could not acquire lock for payment processing");
        }
        return result.value();
    }

    private Payment processLocked(PaymentRequest request) {
        // 1. Idempotência: a chave já foi usada?
        if (payments.findByIdempotencyKey(request.idempotencyKey()).isPresent()) {
            log.warn("Duplicate payment attempt detected: {}", request.idempotencyKey());
            throw new DuplicatePaymentException("Payment already processed");
        }

        // 2. A reserva existe, está ativa e não expirou?
        if (!reservationService.isReservationValid(request.reservationToken())) {
            throw new BusinessException("Invalid or expired reservation");
        }
        ReservationView reservation = reservationService.getReservationByToken(request.reservationToken());

        // 3. Exclusão mútua sobre a reserva (job de expiração, cancelamento e outros pagamentos).
        LockResult<Payment> inner = locks.tryWithLock("reservation:" + request.reservationToken(), RESERVATION_LOCK,
                () -> chargeAndSettle(reservation, request));
        if (!inner.acquired()) {
            throw new BusinessException("Could not acquire lock for reservation");
        }
        return inner.value();
    }

    private Payment chargeAndSettle(ReservationView stale, PaymentRequest request) {
        // Releitura já com o lock da reserva: entre a validação e a aquisição do lock, outro pagamento pode ter
        // concluído (ou o job de expiração ter cancelado). Sem isso, cobraríamos duas vezes.
        ReservationView reservation = reservationService.getReservationByToken(stale.reservationToken());
        if (reservation.status() != ReservationStatus.ACTIVE || reservation.isExpired(ReservationService.now())) {
            throw new BusinessException("Invalid or expired reservation");
        }

        String paymentId = UUID.randomUUID().toString();
        BigDecimal amount = reservation.eventPrice();

        // A chamada ao gateway fica FORA de qualquer transação: não segura conexão nem locks de linha
        // enquanto espera um serviço externo.
        try {
            gateway.charge(new GatewayCharge(paymentId, amount, CURRENCY, request.paymentMethod().name(),
                    reservation.reservationToken()));
        } catch (RuntimeException error) {
            log.error("Payment processing failed: {}", error.getMessage());
            String message = String.valueOf(error.getMessage());

            // Registra o pagamento como FAILED e devolve o assento — na MESMA transação, commitada antes de o erro subir.
            tx.executeWithoutResult(status -> {
                reservationService.releaseActiveReservation(reservation);
                insertPayment(paymentId, request, reservation, amount, PaymentStatus.FAILED, message, null);
            });
            throw new BusinessException("Payment processing failed: " + message);
        }

        return tx.execute(status -> {
            // Ordem de locks: assento -> reserva (subsequência de evento -> assento -> reserva).
            Ticket ticket = tickets.findByIdForUpdate(reservation.ticketId()).orElseThrow(
                    () -> new ResourceNotFoundException("Seat not found"));
            Reservation current = reservations.findByIdForUpdate(reservation.id()).orElse(null);
            if (current == null || current.getStatus() != ReservationStatus.ACTIVE) {
                // Só acontece se o lease do lock expirou durante a cobrança. A cobrança já ocorreu:
                // vale alarme para reconciliação/estorno manual.
                log.error("Reservation {} no longer active after charge {}; manual refund may be required",
                        reservation.reservationToken(), paymentId);
                throw new BusinessException("Reservation is no longer active");
            }

            Payment payment = insertPayment(paymentId, request, reservation, amount, PaymentStatus.COMPLETED, null,
                    ReservationService.now());
            ticket.changeStatus(TicketStatus.SOLD);
            current.setStatus(ReservationStatus.COMPLETED);

            log.info("Payment processed successfully: {}", payment.getId());
            return payment;
        });
    }

    private Payment insertPayment(String paymentId, PaymentRequest request, ReservationView reservation,
                                  BigDecimal amount, PaymentStatus status, String failureReason,
                                  LocalDateTime completedAt) {
        PaymentMethod method = request.paymentMethod();
        try {
            return payments.saveAndFlush(new Payment(paymentId, request.idempotencyKey(), reservation.id(),
                    reservation.ticketId(), amount, CURRENCY, status, method, null, failureReason, completedAt));
        } catch (DataIntegrityViolationException error) {
            // Última barreira de idempotência: duas requisições com a mesma chave que passem pelo lock.
            Throwable cause = NestedExceptionUtils.getMostSpecificCause(error);
            String detail = cause.getMessage() == null ? "" : cause.getMessage();
            if (detail.contains("idempotency_key")) {
                throw new DuplicatePaymentException("Payment already processed");
            }
            throw error;
        }
    }

    public Payment getPaymentByIdempotencyKey(String idempotencyKey) {
        return payments.findByIdempotencyKey(idempotencyKey)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
    }

    public Payment getPaymentByReservationToken(String token) {
        ReservationView reservation = reservationService.getReservationByToken(token);
        return payments.findByReservationId(reservation.id())
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
    }
}
