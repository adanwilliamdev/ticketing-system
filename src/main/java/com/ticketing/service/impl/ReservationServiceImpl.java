package com.ticketing.service.impl;

import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.entity.Event;
import com.ticketing.entity.Reservation;
import com.ticketing.entity.Ticket;
import com.ticketing.entity.Ticket.TicketStatus;
import com.ticketing.exception.BusinessException;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.repository.TicketRepository;
import com.ticketing.service.ReservationService;
import com.ticketing.util.ReservationTokenGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReservationServiceImpl implements ReservationService {
    
    private final ReservationRepository reservationRepository;
    private final TicketRepository ticketRepository;
    private final EventRepository eventRepository;
    private final RedissonClient redissonClient;
    private final ReservationTokenGenerator tokenGenerator;
    
    @Value("${ticketing.reservation.timeout-minutes}")
    private int reservationTimeoutMinutes;
    
    @Override
    @Transactional
    public ReservationResponse createReservation(CreateReservationRequest request) {
        String lockKey = "event:" + request.getEventId() + ":ticket:" + request.getSeatNumber();
        RLock lock = redissonClient.getLock(lockKey);
        
        try {
            if (lock.tryLock(5, 10, TimeUnit.SECONDS)) {
                try {
                    // Find event with pessimistic lock
                    Event event = eventRepository.findByIdWithLock(request.getEventId())
                        .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
                    
                    // Check if event is still available
                    if (event.getAvailableTickets() <= 0) {
                        throw new BusinessException("No tickets available for this event");
                    }
                    
                    // Find ticket with pessimistic lock
                    Ticket ticket = ticketRepository.findByEventIdAndSeatNumberWithLock(
                        request.getEventId(), request.getSeatNumber()
                    ).orElseThrow(() -> new ResourceNotFoundException("Seat not found"));
                    
                    // Check if ticket is available
                    if (ticket.getStatus() != TicketStatus.AVAILABLE) {
                        throw new BusinessException("Seat is not available");
                    }
                    
                    // Check for existing active reservation
                    boolean hasActiveReservation = reservationRepository.existsByTicketIdAndStatusIn(
                        ticket.getId(), 
                        List.of(Reservation.ReservationStatus.ACTIVE)
                    );
                    
                    if (hasActiveReservation) {
                        throw new BusinessException("Seat already has an active reservation");
                    }
                    
                    // Create reservation
                    Reservation reservation = Reservation.builder()
                        .reservationToken(tokenGenerator.generateToken())
                        .event(event)
                        .ticket(ticket)
                        .userId(request.getUserId())
                        .userEmail(request.getUserEmail())
                        .expiresAt(LocalDateTime.now().plusMinutes(reservationTimeoutMinutes))
                        .status(Reservation.ReservationStatus.ACTIVE)
                        .build();
                    
                    // Update ticket status
                    ticket.setStatus(TicketStatus.RESERVED);
                    event.setAvailableTickets(event.getAvailableTickets() - 1);
                    
                    reservation = reservationRepository.save(reservation);
                    
                    log.info("Reservation created successfully: {}", reservation.getReservationToken());
                    
                    return buildReservationResponse(reservation);
                    
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            } else {
                throw new BusinessException("Could not acquire lock for seat reservation");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("Reservation process interrupted");
        }
    }
    
    @Override
    @Transactional
    public void releaseReservation(String token) {
        Reservation reservation = reservationRepository.findByReservationToken(token)
            .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));
        
        String lockKey = "reservation:" + token;
        RLock lock = redissonClient.getLock(lockKey);
        
        try {
            if (lock.tryLock(5, 5, TimeUnit.SECONDS)) {
                try {
                    if (reservation.getStatus() == Reservation.ReservationStatus.ACTIVE) {
                        // Release ticket
                        Ticket ticket = reservation.getTicket();
                        ticket.setStatus(TicketStatus.AVAILABLE);
                        
                        Event event = reservation.getEvent();
                        event.setAvailableTickets(event.getAvailableTickets() + 1);
                        
                        reservation.setStatus(Reservation.ReservationStatus.CANCELLED);
                        reservationRepository.save(reservation);
                        
                        log.info("Reservation released: {}", token);
                    }
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Error releasing reservation: {}", token, e);
        }
    }
    
    @Override
    @Async
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void expireReservations() {
        LocalDateTime now = LocalDateTime.now();
        List<Reservation> expiredReservations = reservationRepository
            .findByStatusAndExpiresAtBefore(Reservation.ReservationStatus.ACTIVE, now);
        
        log.info("Found {} expired reservations to process", expiredReservations.size());
        
        for (Reservation reservation : expiredReservations) {
            try {
                releaseReservation(reservation.getReservationToken());
            } catch (Exception e) {
                log.error("Error processing expired reservation: {}", 
                    reservation.getReservationToken(), e);
            }
        }
    }
    
    @Override
    public Reservation getReservationByToken(String token) {
        return reservationRepository.findByReservationToken(token)
            .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));
    }
    
    @Override
    @Transactional
    public ReservationResponse confirmReservation(String token) {
        Reservation reservation = getReservationByToken(token);
        
        if (reservation.getStatus() != Reservation.ReservationStatus.ACTIVE) {
            throw new BusinessException("Reservation is not active");
        }
        
        if (reservation.isExpired()) {
            throw new BusinessException("Reservation has expired");
        }
        
        // Extend reservation time for payment processing
        reservation.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        reservation = reservationRepository.save(reservation);
        
        return buildReservationResponse(reservation);
    }
    
    @Override
    public ReservationResponse getReservationResponseByToken(String token) {
        return buildReservationResponse(getReservationByToken(token));
    }
    
    @Override
    public boolean isReservationValid(String token) {
        try {
            Reservation reservation = getReservationByToken(token);
            return reservation.getStatus() == Reservation.ReservationStatus.ACTIVE 
                && !reservation.isExpired();
        } catch (ResourceNotFoundException e) {
            return false;
        }
    }
    
    private ReservationResponse buildReservationResponse(Reservation reservation) {
        long timeRemaining = java.time.Duration.between(
            LocalDateTime.now(), 
            reservation.getExpiresAt()
        ).getSeconds();
        
        return ReservationResponse.builder()
            .reservationToken(reservation.getReservationToken())
            .eventId(reservation.getEvent().getId())
            .eventName(reservation.getEvent().getName())
            .seatNumber(reservation.getTicket().getSeatNumber())
            .userEmail(reservation.getUserEmail())
            .expiresAt(reservation.getExpiresAt())
            .status(reservation.getStatus().name())
            .timeRemainingSeconds(Math.max(0, timeRemaining))
            .build();
    }
}
