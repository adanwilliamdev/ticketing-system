package com.ticketing.util;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ReservationTokenGeneratorTest {

    private final ReservationTokenGenerator generator = new ReservationTokenGenerator();

    @Test
    void generateToken_naoDeveSerNuloOuVazio() {
        String token = generator.generateToken();

        assertThat(token).isNotNull().isNotBlank();
    }

    @Test
    void generateToken_deveTerTamanhoConsistente() {
        String token = generator.generateToken();

        // Base64 URL-safe sem padding de 32 bytes = 43 caracteres
        assertThat(token).hasSize(43);
    }

    @Test
    void generateToken_naoDeveConterCaracteresInvalidosParaUrl() {
        String token = generator.generateToken();

        assertThat(token).matches("^[A-Za-z0-9_-]+$");
    }

    @Test
    void generateToken_deveGerarTokensUnicos() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            tokens.add(generator.generateToken());
        }

        assertThat(tokens).hasSize(1000);
    }
}
