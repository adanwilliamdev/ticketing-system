package com.ticketing.service;

import com.ticketing.config.TicketingProperties;
import com.ticketing.domain.Event;
import com.ticketing.domain.Reservation;
import com.ticketing.domain.ReservationStatus;
import com.ticketing.domain.Ticket;
import com.ticketing.domain.TicketStatus;
import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.lock.LockOptions;
import com.ticketing.lock.LockResult;
import com.ticketing.lock.RedisLockManager;
import com.ticketing.mapper.Mappers;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.repository.ReservationView;
import com.ticketing.repository.TicketRepository;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Regras de reserva. Ordem das operações em escritas: lock distribuído -> transação -> COMMIT -> libera o lock.
 * Ordem fixa de locks de linha (evento -> assento -> reserva) em todos os fluxos, para que transações
 * concorrentes nunca se travem em ciclo.
 */
@Service
public class ReservationService {

    private static final Logger log = LoggerFactory.getLogger(ReservationService.class);

    static final LockOptions CREATE_LOCK = new LockOptions(5_000, 10_000);
    static final LockOptions RELEASE_LOCK = new LockOptions(5_000, 5_000);
    static final int CONFIRM_EXTENSION_MINUTES = 5;

    private final EventRepository events;
    private final TicketRepository tickets;
    private final ReservationRepository reservations;
    private final RedisLockManager locks;
    private final ReservationTokenGenerator tokens;
    private final TransactionTemplate tx;
    private final int timeoutMinutes;

    public ReservationService(EventRepository events, TicketRepository tickets, ReservationRepository reservations,
                              RedisLockManager locks, ReservationTokenGenerator tokens,
                              PlatformTransactionManager transactionManager, TicketingProperties properties) {
        this.events = events;
        this.tickets = tickets;
        this.reservations = reservations;
        this.locks = locks;
        this.tokens = tokens;
        this.tx = new TransactionTemplate(transactionManager);
        this.timeoutMinutes = properties.reservationTimeoutMinutes();
    }

    /** "Agora" em UTC sem fuso, para casar com as colunas TIMESTAMP do banco. */
    static LocalDateTime now() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    public ReservationView getReservationByToken(String token) {
        return reservations.findViewByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));
    }

    public ReservationResponse createReservation(CreateReservationRequest request) {
        String lockKey = "event:" + request.eventId() + ":ticket:" + request.seatNumber();
        LockResult<ReservationResponse> result =
                locks.tryWithLock(lockKey, CREATE_LOCK, () -> tx.execute(status -> doCreate(request)));
        if (!result.acquired()) {
            throw new BusinessException("Could not acquire lock for seat reservation");
        }
        return result.value();
    }

    private ReservationResponse doCreate(CreateReservationRequest request) {
        Event event = events.findByIdForUpdate(request.eventId())
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        if (event.getAvailableTickets() <= 0) {
            throw new BusinessException("No tickets available for this event");
        }

        Ticket ticket = tickets.findByEventAndSeatForUpdate(request.eventId(), request.seatNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Seat not found"));
        if (ticket.getStatus() != TicketStatus.AVAILABLE) {
            throw new BusinessException("Seat is not available");
        }
        if (reservations.existsByTicketIdAndStatus(ticket.getId(), ReservationStatus.ACTIVE)) {
            throw new BusinessException("Seat already has an active reservation");
        }

        LocalDateTime now = now();
        ticket.changeStatus(TicketStatus.RESERVED);
        event.decrementAvailable();

        Reservation reservation = reservations.saveAndFlush(new Reservation(
                tokens.generate(),
                event.getId(),
                ticket.getId(),
                request.userId(),
                request.userEmail(),
                now.plusMinutes(timeoutMinutes)));

        log.info("Reservation created successfully: {}", reservation.getReservationToken());
        return Mappers.toReservationResponse(new ReservationView(
                reservation.getId(),
                reservation.getReservationToken(),
                reservation.getEventId(),
                reservation.getTicketId(),
                reservation.getUserId(),
                reservation.getUserEmail(),
                reservation.getExpiresAt(),
                reservation.getStatus(),
                event.getName(),
                event.getPrice(),
                ticket.getSeatNumber()), now);
    }

    /**
     * Devolve o assento e a vaga do evento e cancela a reserva — se ela ainda estiver ACTIVE.
     * <b>Deve rodar dentro de uma transação.</b> A reserva é relida já com lock: quem chamou pode ter uma
     * versão desatualizada (ex.: um pagamento concluiu enquanto o job de expiração esperava).
     */
    public boolean releaseActiveReservation(ReservationView reservation) {
        Event event = events.findByIdForUpdate(reservation.eventId()).orElse(null);
        Ticket ticket = tickets.findByIdForUpdate(reservation.ticketId()).orElse(null);
        Reservation current = reservations.findByIdForUpdate(reservation.id()).orElse(null);
        if (current == null || current.getStatus() != ReservationStatus.ACTIVE) {
            return false;
        }

        if (ticket != null) {
            ticket.changeStatus(TicketStatus.AVAILABLE);
        }
        if (event != null) {
            event.incrementAvailable();
        }
        current.setStatus(ReservationStatus.CANCELLED);
        return true;
    }

    public void releaseReservation(String token) {
        ReservationView reservation = getReservationByToken(token);

        LockResult<Boolean> result = locks.tryWithLock("reservation:" + token, RELEASE_LOCK,
                () -> tx.execute(status -> releaseActiveReservation(reservation)));

        // Não conseguir o lock não é erro: quem o segura está mexendo na reserva.
        if (!result.acquired()) {
            log.warn("Reservation {} not released: lock busy", token);
        } else if (Boolean.TRUE.equals(result.value())) {
            log.info("Reservation released: {}", token);
        }
    }

    public int expireReservations() {
        List<ReservationView> expired = reservations.findExpiredActive(now());
        log.info("Found {} expired reservations to process", expired.size());

        int released = 0;
        for (ReservationView reservation : expired) {
            try {
                releaseReservation(reservation.reservationToken());
                released++;
            } catch (RuntimeException error) {
                log.error("Error processing expired reservation: {} ({})", reservation.reservationToken(),
                        error.getMessage());
            }
        }
        return released;
    }

    public ReservationResponse confirmReservation(String token) {
        ReservationView reservation = getReservationByToken(token);
        LocalDateTime now = now();

        if (reservation.status() != ReservationStatus.ACTIVE) {
            throw new BusinessException("Reservation is not active");
        }
        if (reservation.isExpired(now)) {
            throw new BusinessException("Reservation has expired");
        }

        // Comportamento herdado: a nova expiração é "agora + 5 min" (pode até ser menor que a atual).
        LocalDateTime expiresAt = now.plusMinutes(CONFIRM_EXTENSION_MINUTES);
        Boolean updated = tx.execute(status -> reservations.findByIdForUpdate(reservation.id())
                .filter(current -> current.getStatus() == ReservationStatus.ACTIVE)
                .map(current -> {
                    current.setExpiresAt(expiresAt);
                    return true;
                })
                .orElse(false));
        if (!Boolean.TRUE.equals(updated)) {
            throw new BusinessException("Reservation is not active");
        }

        return Mappers.toReservationResponse(reservation.withExpiresAt(expiresAt), now);
    }

    public ReservationResponse getReservationResponseByToken(String token) {
        return Mappers.toReservationResponse(getReservationByToken(token), now());
    }

    public boolean isReservationValid(String token) {
        return reservations.findViewByToken(token)
                .map(r -> r.status() == ReservationStatus.ACTIVE && !r.isExpired(now()))
                .orElse(false);
    }
}
