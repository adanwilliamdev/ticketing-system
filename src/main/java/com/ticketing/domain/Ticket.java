package com.ticketing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Assento de um evento. */
@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "seat_number", nullable = false, length = 50)
    private String seatNumber;

    @Column(length = 50)
    private String section;

    @Column(name = "row_number", length = 50)
    private String rowNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TicketStatus status;

    @Column(name = "version")
    private int version;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected Ticket() {
    }

    public Ticket(Long eventId, String seatNumber, String section, String rowNumber, TicketStatus status) {
        this.eventId = eventId;
        this.seatNumber = seatNumber;
        this.section = section;
        this.rowNumber = rowNumber;
        this.status = status;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public void changeStatus(TicketStatus newStatus) {
        this.status = newStatus;
        this.version++;
    }

    public Long getId() { return id; }
    public Long getEventId() { return eventId; }
    public String getSeatNumber() { return seatNumber; }
    public String getSection() { return section; }
    public String getRowNumber() { return rowNumber; }
    public TicketStatus getStatus() { return status; }
}
