package com.ticketing.web;

import com.ticketing.config.TicketingProperties;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Component;

/** Formatação para as páginas (disponível nos templates como {@code @fmt}). */
@Component("fmt")
public class DisplayFormatter {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

    private final DateTimeFormatter dateTime;

    public DisplayFormatter(TicketingProperties properties) {
        this.dateTime = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy 'às' HH:mm", PT_BR)
                .withZone(ZoneId.of(properties.displayZone()));
    }

    public String currency(BigDecimal amount) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(amount);
    }

    /** Recebe o instante em ISO-8601 (UTC) e formata no fuso de exibição. */
    public String dateTime(String iso) {
        return dateTime.format(Instant.parse(iso));
    }

    public String countdown(int totalSeconds) {
        int seconds = Math.max(0, totalSeconds);
        return String.format("%d:%02d", seconds / 60, seconds % 60);
    }
}
