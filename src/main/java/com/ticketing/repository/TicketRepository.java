package com.ticketing.repository;

import com.ticketing.domain.Ticket;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Ticket t where t.id = :id")
    Optional<Ticket> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Ticket t where t.eventId = :eventId and t.seatNumber = :seatNumber")
    Optional<Ticket> findByEventAndSeatForUpdate(@Param("eventId") Long eventId, @Param("seatNumber") String seatNumber);

    List<Ticket> findByEventIdOrderByIdAsc(Long eventId);
}
