package com.ticketing.repository;

import com.ticketing.domain.Reservation;
import com.ticketing.domain.ReservationStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    String VIEW_SELECT = "select new com.ticketing.repository.ReservationView("
            + "r.id, r.reservationToken, r.eventId, r.ticketId, r.userId, r.userEmail, r.expiresAt, r.status, "
            + "e.name, e.price, t.seatNumber) "
            + "from Reservation r, Event e, Ticket t where e.id = r.eventId and t.id = r.ticketId ";

    @Query(VIEW_SELECT + "and r.reservationToken = :token")
    Optional<ReservationView> findViewByToken(@Param("token") String token);

    @Query(VIEW_SELECT + "and r.status = com.ticketing.domain.ReservationStatus.ACTIVE and r.expiresAt < :now "
            + "order by r.expiresAt")
    List<ReservationView> findExpiredActive(@Param("now") LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.id = :id")
    Optional<Reservation> findByIdForUpdate(@Param("id") Long id);

    boolean existsByTicketIdAndStatus(Long ticketId, ReservationStatus status);
}
