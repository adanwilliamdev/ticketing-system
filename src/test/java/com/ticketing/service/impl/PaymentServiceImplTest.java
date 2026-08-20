package com.ticketing.service.impl;

import com.ticketing.dto.PaymentRequest;
import com.ticketing.entity.Event;
import com.ticketing.entity.Payment;
import com.ticketing.entity.Reservation;
import com.ticketing.entity.Ticket;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.DuplicatePaymentException;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.repository.PaymentRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private ReservationRepository reservationRepository;
    @Mock
    private ReservationService reservationService;
    @Mock
    private RedissonClient redissonClient;
    @Mock
    private RLock lock;

    private PaymentServiceImpl paymentService;

    private Reservation reservation;
    private PaymentRequest request;

    @BeforeEach
    void setUp() {
        PaymentServiceImpl real = new PaymentServiceImpl(
            paymentRepository, reservationRepository, reservationService, redissonClient
        );
        ReflectionTestUtils.setField(real, "idempotencyKeyTTL", 86_400_000L);
        // spy: permite substituir a chamada ao "gateway externo" (que tem um Thread.sleep real)
        paymentService = spy(real);

        Event event = Event.builder()
            .id(1L)
            .name("Rock Concert 2024")
            .price(new BigDecimal("150.00"))
            .build();

        Ticket ticket = Ticket.builder()
            .id(1L)
            .event(event)
            .seatNumber("A001")
            .status(Ticket.TicketStatus.RESERVED)
            .build();

        reservation = Reservation.builder()
            .id(1L)
            .reservationToken("res-token-123")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .build();

        request = PaymentRequest.builder()
            .reservationToken("res-token-123")
            .paymentMethod(Payment.PaymentMethod.PIX)
            .idempotencyKey("idem-key-123")
            .build();
    }

    @Test
    void processPayment_deveProcessarComSucesso() throws InterruptedException {
        when(paymentRepository.findByIdempotencyKey("idem-key-123")).thenReturn(Optional.empty());
        when(reservationService.isReservationValid("res-token-123")).thenReturn(true);
        when(reservationService.getReservationByToken("res-token-123")).thenReturn(reservation);

        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        doNothing().when(paymentService).processPaymentWithGateway(any(Payment.class), any(PaymentRequest.class));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.processPayment(request);

        assertThat(result.getStatus()).isEqualTo(Payment.PaymentStatus.COMPLETED);
        assertThat(result.getAmount()).isEqualByComparingTo("150.00");
        assertThat(result.getCurrency()).isEqualTo("BRL");
        assertThat(reservation.getTicket().getStatus()).isEqualTo(Ticket.TicketStatus.SOLD);
        assertThat(reservation.getStatus()).isEqualTo(Reservation.ReservationStatus.COMPLETED);
    }

    @Test
    void processPayment_deveFalharComPagamentoDuplicado() throws InterruptedException {
        when(paymentRepository.findByIdempotencyKey("idem-key-123"))
            .thenReturn(Optional.of(Payment.builder().id(99L).idempotencyKey("idem-key-123").build()));

        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);

        assertThatThrownBy(() -> paymentService.processPayment(request))
            .isInstanceOf(DuplicatePaymentException.class)
            .hasMessageContaining("already processed");

        verify(reservationService, never()).getReservationByToken(anyString());
    }

    @Test
    void processPayment_deveFalharQuandoReservaInvalidaOuExpirada() throws InterruptedException {
        when(paymentRepository.findByIdempotencyKey("idem-key-123")).thenReturn(Optional.empty());
        when(reservationService.isReservationValid("res-token-123")).thenReturn(false);

        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);

        assertThatThrownBy(() -> paymentService.processPayment(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Invalid or expired reservation");

        verify(paymentRepository, never()).save(any());
    }

    @Test
    void processPayment_deveMarcarComoFailedELiberarReservaQuandoGatewayFalha() throws InterruptedException {
        when(paymentRepository.findByIdempotencyKey("idem-key-123")).thenReturn(Optional.empty());
        when(reservationService.isReservationValid("res-token-123")).thenReturn(true);
        when(reservationService.getReservationByToken("res-token-123")).thenReturn(reservation);

        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        doThrow(new RuntimeException("gateway indisponivel"))
            .when(paymentService).processPaymentWithGateway(any(Payment.class), any(PaymentRequest.class));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> paymentService.processPayment(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Payment processing failed");

        verify(paymentRepository).save(argThat(p -> p.getStatus() == Payment.PaymentStatus.FAILED));
        verify(reservationService).releaseReservation("res-token-123");
    }

    @Test
    void processPayment_deveFalharQuandoNaoConseguirAdquirirLockDePagamento() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(false);

        assertThatThrownBy(() -> paymentService.processPayment(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Could not acquire lock for payment");

        verify(paymentRepository, never()).findByIdempotencyKey(anyString());
    }

    @Test
    void getPaymentByIdempotencyKey_deveRetornarPagamentoQuandoExiste() {
        Payment payment = Payment.builder().id(1L).idempotencyKey("idem-key-123").build();
        when(paymentRepository.findByIdempotencyKey("idem-key-123")).thenReturn(Optional.of(payment));

        Payment result = paymentService.getPaymentByIdempotencyKey("idem-key-123");

        assertThat(result).isSameAs(payment);
    }

    @Test
    void getPaymentByIdempotencyKey_deveFalharQuandoNaoExiste() {
        when(paymentRepository.findByIdempotencyKey("inexistente")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentService.getPaymentByIdempotencyKey("inexistente"))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getPaymentByReservationToken_deveRetornarPagamentoAssociado() {
        Payment payment = Payment.builder().id(1L).reservation(reservation).build();
        when(reservationService.getReservationByToken("res-token-123")).thenReturn(reservation);
        when(paymentRepository.findByReservationId(1L)).thenReturn(Optional.of(payment));

        Payment result = paymentService.getPaymentByReservationToken("res-token-123");

        assertThat(result).isSameAs(payment);
    }
}
