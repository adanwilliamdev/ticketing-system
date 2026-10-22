package com.ticketing.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Configuração da aplicação (prefixo {@code ticketing} em application.yml). */
@ConfigurationProperties(prefix = "ticketing")
public record TicketingProperties(
        @DefaultValue("10") int reservationTimeoutMinutes,
        @DefaultValue("2000") int paymentGatewayDelayMs,
        @DefaultValue("") String cronSecret,
        @DefaultValue("America/Sao_Paulo") String displayZone,
        @DefaultValue Expiration expiration,
        @DefaultValue Seed seed) {

    public record Expiration(@DefaultValue("true") boolean enabled, @DefaultValue("60000") long intervalMs) {
    }

    public record Seed(@DefaultValue("false") boolean enabled) {
    }
}
