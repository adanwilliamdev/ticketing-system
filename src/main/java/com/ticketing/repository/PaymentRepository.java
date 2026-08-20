package com.ticketing.repository;

import com.ticketing.entity.Payment;
import com.ticketing.entity.Payment.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    
    Optional<Payment> findByIdempotencyKey(String idempotencyKey);
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.idempotencyKey = :key")
    Optional<Payment> findByIdempotencyKeyWithLock(@Param("key") String key);
    
    Optional<Payment> findByReservationId(Long reservationId);
}
