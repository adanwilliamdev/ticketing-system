package com.ticketing.repository;

import com.ticketing.entity.Ticket;
import com.ticketing.entity.Ticket.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Ticket t WHERE t.id = :id")
    Optional<Ticket> findByIdWithLock(@Param("id") Long id);
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Ticket t WHERE t.event.id = :eventId AND t.status = 'AVAILABLE' ORDER BY t.id")
    List<Ticket> findAvailableTicketsWithLock(@Param("eventId") Long eventId);
    
    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.event.id = :eventId AND t.status = 'AVAILABLE'")
    Long countAvailableTickets(@Param("eventId") Long eventId);
    
    @Modifying
    @Query("UPDATE Ticket t SET t.status = :status WHERE t.id = :id")
    int updateTicketStatus(@Param("id") Long id, @Param("status") TicketStatus status);
    
    Optional<Ticket> findByEventIdAndSeatNumber(Long eventId, String seatNumber);
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Ticket t WHERE t.event.id = :eventId AND t.seatNumber = :seatNumber")
    Optional<Ticket> findByEventIdAndSeatNumberWithLock(@Param("eventId") Long eventId, @Param("seatNumber") String seatNumber);
}
