package com.ticketing.seed;

import com.ticketing.domain.Event;
import com.ticketing.domain.EventStatus;
import com.ticketing.domain.Ticket;
import com.ticketing.domain.TicketStatus;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.TicketRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Popula dados de exemplo quando {@code SEED_ENABLED=true} e ainda não há nenhum evento. As datas são relativas
 * a "agora", para que os eventos de exemplo estejam sempre no futuro.
 */
@Component
@ConditionalOnProperty(prefix = "ticketing.seed", name = "enabled", havingValue = "true")
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final EventRepository events;
    private final TicketRepository tickets;
    private final TransactionTemplate tx;

    public DataSeeder(EventRepository events, TicketRepository tickets, PlatformTransactionManager transactionManager) {
        this.events = events;
        this.tickets = tickets;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(ApplicationArguments args) {
        tx.executeWithoutResult(status -> {
            if (events.count() > 0) {
                log.info("Seed ignorado: já existem eventos cadastrados");
                return;
            }
            LocalDateTime base = LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.HOURS);

            createEvent(new Event("Rock Concert", "Amazing rock concert with multiple bands",
                            base.plusDays(60).withHour(23), base.plusDays(61).withHour(2), "Stadium Arena", 1000,
                            new BigDecimal("150.00"), EventStatus.PUBLISHED),
                    "A", 1000, 20, new int[] {100, 300});

            createEvent(new Event("Tech Conference", "Annual technology conference",
                            base.plusDays(30).withHour(12), base.plusDays(32).withHour(21), "Convention Center", 500,
                            new BigDecimal("299.00"), EventStatus.PUBLISHED),
                    "B", 500, 25, new int[] {50, 150});

            createEvent(new Event("Jazz Night", "Classic jazz performance",
                            base.plusDays(15).withHour(22), base.plusDays(16).withHour(1), "Jazz Club", 200,
                            new BigDecimal("75.00"), EventStatus.PUBLISHED),
                    "C", 200, 10, new int[] {30, 100});

            log.info("Dados de exemplo inseridos com sucesso");
        });
    }

    /** Assentos até {@code limits[0]} são VIP, até {@code limits[1]} Premium e o restante Regular. */
    private void createEvent(Event event, String prefix, int seats, int seatsPerRow, int[] limits) {
        Event saved = events.save(event);
        List<Ticket> batch = new ArrayList<>(seats);
        for (int i = 1; i <= seats; i++) {
            String section = i <= limits[0] ? "VIP" : i <= limits[1] ? "Premium" : "Regular";
            batch.add(new Ticket(saved.getId(), String.format("%s%03d", prefix, i), section,
                    "Row " + ((i + seatsPerRow - 1) / seatsPerRow), TicketStatus.AVAILABLE));
        }
        tickets.saveAll(batch);
    }
}
