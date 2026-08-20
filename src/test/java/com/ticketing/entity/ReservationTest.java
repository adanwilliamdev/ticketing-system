package com.ticketing.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ReservationTest {

    @Test
    void isExpired_deveRetornarTrueQuandoDataDeExpiracaoJaPassou() {
        Reservation reservation = Reservation.builder()
            .expiresAt(LocalDateTime.now().minusMinutes(1))
            .build();

        assertThat(reservation.isExpired()).isTrue();
    }

    @Test
    void isExpired_deveRetornarFalseQuandoDataDeExpiracaoNoFuturo() {
        Reservation reservation = Reservation.builder()
            .expiresAt(LocalDateTime.now().plusMinutes(1))
            .build();

        assertThat(reservation.isExpired()).isFalse();
    }
}
