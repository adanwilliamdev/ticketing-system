package com.ticketing.service.impl;

import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.entity.Event;
import com.ticketing.entity.Reservation;
import com.ticketing.entity.Ticket;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.repository.TicketRepository;
import com.ticketing.util.ReservationTokenGenerator;
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
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationServiceImplTest {

    @Mock
    private ReservationRepository reservationRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private RedissonClient redissonClient;
    @Mock
    private ReservationTokenGenerator tokenGenerator;
    @Mock
    private RLock lock;

    private ReservationServiceImpl reservationService;

    private Event event;
    private Ticket ticket;

    @BeforeEach
    void setUp() {
        reservationService = new ReservationServiceImpl(
            reservationRepository, ticketRepository, eventRepository, redissonClient, tokenGenerator
        );
        ReflectionTestUtils.setField(reservationService, "reservationTimeoutMinutes", 10);

        event = Event.builder()
            .id(1L)
            .name("Rock Concert 2024")
            .availableTickets(10)
            .price(new BigDecimal("150.00"))
            .status(Event.EventStatus.PUBLISHED)
            .build();

        ticket = Ticket.builder()
            .id(1L)
            .event(event)
            .seatNumber("A001")
            .status(Ticket.TicketStatus.AVAILABLE)
            .build();
    }

    private CreateReservationRequest defaultRequest() {
        return CreateReservationRequest.builder()
            .eventId(1L)
            .seatNumber("A001")
            .userEmail("user@example.com")
            .userId("user-1")
            .build();
    }

    @Test
    void createReservation_deveCriarComSucessoQuandoAssentoDisponivel() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        when(eventRepository.findByIdWithLock(1L)).thenReturn(Optional.of(event));
        when(ticketRepository.findByEventIdAndSeatNumberWithLock(1L, "A001")).thenReturn(Optional.of(ticket));
        when(reservationRepository.existsByTicketIdAndStatusIn(eq(1L), anyList())).thenReturn(false);
        when(tokenGenerator.generateToken()).thenReturn("token-abc-123");
        when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        ReservationResponse response = reservationService.createReservation(defaultRequest());

        assertThat(response.getReservationToken()).isEqualTo("token-abc-123");
        assertThat(response.getEventId()).isEqualTo(1L);
        assertThat(response.getSeatNumber()).isEqualTo("A001");
        assertThat(response.getStatus()).isEqualTo(Reservation.ReservationStatus.ACTIVE.name());
        assertThat(response.getTimeRemainingSeconds()).isGreaterThan(0);

        assertThat(ticket.getStatus()).isEqualTo(Ticket.TicketStatus.RESERVED);
        assertThat(event.getAvailableTickets()).isEqualTo(9);
        verify(lock).unlock();
    }

    @Test
    void createReservation_deveFalharQuandoEventoSemIngressosDisponiveis() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        event.setAvailableTickets(0);
        when(eventRepository.findByIdWithLock(1L)).thenReturn(Optional.of(event));

        assertThatThrownBy(() -> reservationService.createReservation(defaultRequest()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("No tickets available");

        verify(reservationRepository, never()).save(any());
    }

    @Test
    void createReservation_deveFalharQuandoAssentoNaoExiste() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        when(eventRepository.findByIdWithLock(1L)).thenReturn(Optional.of(event));
        when(ticketRepository.findByEventIdAndSeatNumberWithLock(1L, "A001")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reservationService.createReservation(defaultRequest()))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Seat not found");
    }

    @Test
    void createReservation_deveFalharQuandoAssentoJaReservadoOuVendido() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        ticket.setStatus(Ticket.TicketStatus.SOLD);
        when(eventRepository.findByIdWithLock(1L)).thenReturn(Optional.of(event));
        when(ticketRepository.findByEventIdAndSeatNumberWithLock(1L, "A001")).thenReturn(Optional.of(ticket));

        assertThatThrownBy(() -> reservationService.createReservation(defaultRequest()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Seat is not available");
    }

    @Test
    void createReservation_deveFalharQuandoJaExisteReservaAtivaParaOAssento() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        when(eventRepository.findByIdWithLock(1L)).thenReturn(Optional.of(event));
        when(ticketRepository.findByEventIdAndSeatNumberWithLock(1L, "A001")).thenReturn(Optional.of(ticket));
        when(reservationRepository.existsByTicketIdAndStatusIn(eq(1L), anyList())).thenReturn(true);

        assertThatThrownBy(() -> reservationService.createReservation(defaultRequest()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("already has an active reservation");
    }

    @Test
    void createReservation_deveFalharQuandoNaoConseguirAdquirirLock() throws InterruptedException {
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(false);

        assertThatThrownBy(() -> reservationService.createReservation(defaultRequest()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Could not acquire lock");

        verify(eventRepository, never()).findByIdWithLock(any());
    }

    @Test
    void releaseReservation_deveLiberarAssentoEIncrementarIngressosDisponiveis() throws InterruptedException {
        Reservation reservation = Reservation.builder()
            .id(1L)
            .reservationToken("token-abc-123")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().plusMinutes(10))
            .build();

        ticket.setStatus(Ticket.TicketStatus.RESERVED);
        event.setAvailableTickets(9);

        when(reservationRepository.findByReservationToken("token-abc-123")).thenReturn(Optional.of(reservation));
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        reservationService.releaseReservation("token-abc-123");

        assertThat(ticket.getStatus()).isEqualTo(Ticket.TicketStatus.AVAILABLE);
        assertThat(event.getAvailableTickets()).isEqualTo(10);
        assertThat(reservation.getStatus()).isEqualTo(Reservation.ReservationStatus.CANCELLED);
        verify(reservationRepository).save(reservation);
    }

    @Test
    void isReservationValid_deveRetornarFalseQuandoReservaNaoExiste() {
        when(reservationRepository.findByReservationToken("inexistente")).thenReturn(Optional.empty());

        boolean valid = reservationService.isReservationValid("inexistente");

        assertThat(valid).isFalse();
    }

    @Test
    void isReservationValid_deveRetornarFalseQuandoReservaExpirada() {
        Reservation expired = Reservation.builder()
            .reservationToken("token-expirado")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().minusMinutes(1))
            .build();

        when(reservationRepository.findByReservationToken("token-expirado")).thenReturn(Optional.of(expired));

        boolean valid = reservationService.isReservationValid("token-expirado");

        assertThat(valid).isFalse();
    }

    @Test
    void isReservationValid_deveRetornarTrueQuandoReservaAtivaENaoExpirada() {
        Reservation active = Reservation.builder()
            .reservationToken("token-valido")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .build();

        when(reservationRepository.findByReservationToken("token-valido")).thenReturn(Optional.of(active));

        boolean valid = reservationService.isReservationValid("token-valido");

        assertThat(valid).isTrue();
    }

    @Test
    void confirmReservation_deveFalharQuandoReservaNaoEstaAtiva() {
        Reservation cancelled = Reservation.builder()
            .reservationToken("token-cancelado")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.CANCELLED)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .build();

        when(reservationRepository.findByReservationToken("token-cancelado")).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> reservationService.confirmReservation("token-cancelado"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("not active");
    }

    @Test
    void confirmReservation_deveFalharQuandoReservaExpirada() {
        Reservation expired = Reservation.builder()
            .reservationToken("token-expirado")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().minusSeconds(5))
            .build();

        when(reservationRepository.findByReservationToken("token-expirado")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> reservationService.confirmReservation("token-expirado"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("expired");
    }

    @Test
    void confirmReservation_deveEstenderExpiracaoQuandoValida() {
        Reservation active = Reservation.builder()
            .reservationToken("token-valido")
            .event(event)
            .ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().plusMinutes(1))
            .build();

        when(reservationRepository.findByReservationToken("token-valido")).thenReturn(Optional.of(active));
        when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        ReservationResponse response = reservationService.confirmReservation("token-valido");

        assertThat(response.getTimeRemainingSeconds()).isGreaterThan(200); // ~5 minutos de extensão
    }

    @Test
    void expireReservations_deveLiberarTodasAsReservasExpiradas() throws InterruptedException {
        Reservation expired1 = Reservation.builder()
            .id(1L).reservationToken("token-1").event(event).ticket(ticket)
            .status(Reservation.ReservationStatus.ACTIVE)
            .expiresAt(LocalDateTime.now().minusMinutes(1))
            .build();

        when(reservationRepository.findByStatusAndExpiresAtBefore(eq(Reservation.ReservationStatus.ACTIVE), any()))
            .thenReturn(List.of(expired1));
        when(reservationRepository.findByReservationToken("token-1")).thenReturn(Optional.of(expired1));
        when(redissonClient.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);

        reservationService.expireReservations();

        assertThat(expired1.getStatus()).isEqualTo(Reservation.ReservationStatus.CANCELLED);
        verify(reservationRepository).save(expired1);
    }
}
