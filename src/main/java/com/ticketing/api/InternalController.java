package com.ticketing.api;

import com.ticketing.config.TicketingProperties;
import com.ticketing.service.ReservationService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Alternativa ao job em processo ({@code EXPIRATION_JOB_ENABLED=false}): agende uma chamada periódica com
 * {@code Authorization: Bearer <CRON_SECRET>}. Sem CRON_SECRET, o endpoint fica desativado.
 */
@RestController
@RequestMapping("/internal")
public class InternalController {

    private final ReservationService reservations;
    private final String cronSecret;

    public InternalController(ReservationService reservations, TicketingProperties properties) {
        this.reservations = reservations;
        this.cronSecret = properties.cronSecret();
    }

    @RequestMapping(path = "/expire-reservations", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> expireReservations(
            @RequestHeader(name = "Authorization", required = false) String authorization) {
        if (!authorized(authorization)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(Map.of("released", reservations.expireReservations()));
    }

    private boolean authorized(String header) {
        if (cronSecret == null || cronSecret.isEmpty() || header == null) {
            return false;
        }
        byte[] expected = ("Bearer " + cronSecret).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, header.getBytes(StandardCharsets.UTF_8));
    }
}
