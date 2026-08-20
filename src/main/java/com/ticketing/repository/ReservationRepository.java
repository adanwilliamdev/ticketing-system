package com.ticketing.repository;

import com.ticketing.entity.Reservation;
import com.ticketing.entity.Reservation.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Reservation r WHERE r.id = :id")
    Optional<Reservation> findByIdWithLock(@Param("id") Long id);
    
    Optional<Reservation> findByReservationToken(String token);
    
    List<Reservation> findByStatusAndExpiresAtBefore(ReservationStatus status, LocalDateTime now);
    
    @Modifying
    @Query("UPDATE Reservation r SET r.status = :status WHERE r.id = :id")
    int updateReservationStatus(@Param("id") Long id, @Param("status") ReservationStatus status);
    
    boolean existsByTicketIdAndStatusIn(Long ticketId, List<ReservationStatus> statuses);
}
