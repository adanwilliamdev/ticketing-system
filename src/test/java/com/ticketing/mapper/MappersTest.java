package com.ticketing.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.ticketing.domain.ReservationStatus;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.repository.ReservationView;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class MappersTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 1, 10, 12, 0, 0);

    private static ReservationView view(LocalDateTime expiresAt) {
        return new ReservationView(1L, "tok", 2L, 3L, null, "a@b.com", expiresAt, ReservationStatus.ACTIVE,
                "Show", new BigDecimal("150.00"), "A001");
    }

    @Test
    void isoUsesUtcSuffix() {
        assertEquals("2026-01-10T12:00:00Z", Mappers.iso(NOW));
        assertNull(Mappers.iso(null));
    }

    @Test
    void remainingSecondsAreComputedFromExpiration() {
        ReservationResponse response = Mappers.toReservationResponse(view(NOW.plusMinutes(10)), NOW);

        assertEquals(600, response.timeRemainingSeconds());
        assertEquals("2026-01-10T12:10:00Z", response.expiresAt());
        assertEquals("A001", response.seatNumber());
    }

    @Test
    void remainingSecondsNeverGoNegative() {
        assertEquals(0, Mappers.toReservationResponse(view(NOW.minusMinutes(5)), NOW).timeRemainingSeconds());
    }

    @Test
    void reservationIsExpiredOnlyStrictlyAfterExpiration() {
        assertFalse(view(NOW).isExpired(NOW));
        assertTrue(view(NOW).isExpired(NOW.plusSeconds(1)));
    }

    @Test
    void withExpiresAtReplacesOnlyTheExpiration() {
        ReservationView updated = view(NOW).withExpiresAt(NOW.plusMinutes(5));

        assertEquals(NOW.plusMinutes(5), updated.expiresAt());
        assertEquals("tok", updated.reservationToken());
    }
}
