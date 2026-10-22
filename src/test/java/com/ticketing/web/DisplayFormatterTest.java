package com.ticketing.web;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.ticketing.config.TicketingProperties;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class DisplayFormatterTest {

    private final DisplayFormatter formatter = new DisplayFormatter(new TicketingProperties(
            10, 0, "", "America/Sao_Paulo",
            new TicketingProperties.Expiration(true, 60_000), new TicketingProperties.Seed(false)));

    @Test
    void formatsCurrencyInBrazilianReais() {
        // O Java separa "R$" do valor com espaço não separável; normaliza para comparar.
        assertEquals("R$ 1.299,50", formatter.currency(new BigDecimal("1299.50")).replace('\u00a0', ' '));
    }

    @Test
    void formatsDateTimeInDisplayZone() {
        assertEquals("15 de dezembro de 2026 às 20:00", formatter.dateTime("2026-12-15T23:00:00Z"));
    }

    @Test
    void formatsCountdown() {
        assertEquals("10:00", formatter.countdown(600));
        assertEquals("0:05", formatter.countdown(5));
        assertEquals("0:00", formatter.countdown(-3));
    }
}
