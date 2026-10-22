package com.ticketing.api;

import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.service.ReservationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private static final Logger log = LoggerFactory.getLogger(ReservationController.class);

    private final ReservationService reservations;

    public ReservationController(ReservationService reservations) {
        this.reservations = reservations;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResponse create(@Valid @RequestBody CreateReservationRequest body) {
        log.info("Creating reservation for event: {}, seat: {}", body.eventId(), body.seatNumber());
        return reservations.createReservation(body);
    }

    @GetMapping("/{token}")
    public ReservationResponse get(@PathVariable("token") String token) {
        return reservations.getReservationResponseByToken(token);
    }

    @DeleteMapping("/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable("token") String token) {
        reservations.releaseReservation(token);
    }

    /** Confirma a reserva e estende o prazo para o pagamento. */
    @PostMapping("/{token}/confirm")
    public ReservationResponse confirm(@PathVariable("token") String token) {
        return reservations.confirmReservation(token);
    }

    /** O corpo da resposta é um boolean. */
    @GetMapping("/{token}/validate")
    public boolean validate(@PathVariable("token") String token) {
        return reservations.isReservationValid(token);
    }
}
