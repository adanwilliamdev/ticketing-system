package com.ticketing.repository;

import com.ticketing.domain.Event;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Event e where e.id = :id")
    Optional<Event> findByIdForUpdate(@Param("id") Long id);

    @Query("select e from Event e where e.availableTickets > 0 and e.status = com.ticketing.domain.EventStatus.PUBLISHED "
            + "order by e.startDateTime, e.id")
    List<Event> findAvailable();
}
