package com.ticketing.job;

import com.ticketing.service.ReservationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Expira reservas vencidas. Roda de imediato e agenda a próxima execução {@code interval-ms} DEPOIS que a
 * anterior terminar (sem sobreposição). Desligue com {@code EXPIRATION_JOB_ENABLED=false} em deploy sem
 * processo permanente e chame {@code POST /internal/expire-reservations} por um cron externo.
 */
@Component
@ConditionalOnProperty(prefix = "ticketing.expiration", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationExpirationJob {

    private static final Logger log = LoggerFactory.getLogger(ReservationExpirationJob.class);

    private final ReservationService reservations;

    public ReservationExpirationJob(ReservationService reservations) {
        this.reservations = reservations;
    }

    @Scheduled(fixedDelayString = "${ticketing.expiration.interval-ms:60000}", initialDelay = 0)
    public void run() {
        try {
            reservations.expireReservations();
        } catch (RuntimeException error) {
            log.error("Reservation expiration job failed: {}", error.getMessage());
        }
    }
}
