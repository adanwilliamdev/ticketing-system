package com.ticketing.web;

import com.ticketing.domain.PaymentMethod;
import com.ticketing.domain.ReservationStatus;
import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.PaymentRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.dto.SeatResponse;
import com.ticketing.exception.ResourceNotFoundException;
import com.ticketing.exception.TicketingException;
import com.ticketing.mapper.Mappers;
import com.ticketing.service.CatalogService;
import com.ticketing.service.PaymentService;
import com.ticketing.service.ReservationService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/** Páginas HTML: lista de eventos, mapa de assentos e reserva (contagem regressiva + pagamento). */
@Controller
public class PageController {

    private final CatalogService catalog;
    private final ReservationService reservations;
    private final PaymentService payments;
    private final Validator validator;

    public PageController(CatalogService catalog, ReservationService reservations, PaymentService payments,
                          Validator validator) {
        this.catalog = catalog;
        this.reservations = reservations;
        this.payments = payments;
        this.validator = validator;
    }

    @GetMapping("/")
    public String home(Model model) {
        model.addAttribute("events", catalog.listAvailableEvents().stream().map(Mappers::toEventResponse).toList());
        return "events/list";
    }

    @GetMapping("/events/{id:\\d+}")
    public String event(@PathVariable("id") long id, Model model) {
        if (id <= 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        try {
            model.addAttribute("event", Mappers.toEventResponse(catalog.getEvent(id)));
            model.addAttribute("sections", groupBySection(catalog.listSeats(id).stream().map(Mappers::toSeatResponse).toList()));
        } catch (ResourceNotFoundException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        }
        return "events/detail";
    }

    @PostMapping("/events/{id:\\d+}/reserve")
    public String reserve(@PathVariable("id") long id,
                          @RequestParam(name = "seatNumber", required = false) String seatNumber,
                          @RequestParam(name = "userEmail", required = false) String userEmail,
                          RedirectAttributes redirect) {
        String email = userEmail == null || userEmail.isBlank() ? null : userEmail.trim();
        redirect.addFlashAttribute("selectedSeat", seatNumber);
        redirect.addFlashAttribute("email", email);

        CreateReservationRequest request = new CreateReservationRequest(id, seatNumber, email, null);
        Set<ConstraintViolation<CreateReservationRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            boolean emailProblem = violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("userEmail"));
            redirect.addFlashAttribute("reserveError", emailProblem ? "Informe um e-mail válido." : "Selecione um assento.");
            return "redirect:/events/" + id;
        }

        try {
            ReservationResponse reservation = reservations.createReservation(request);
            return "redirect:/reservations/" + reservation.reservationToken();
        } catch (TicketingException ex) {
            redirect.addFlashAttribute("reserveError", ErrorMessages.translate(ex.getMessage()));
            return "redirect:/events/" + id;
        }
    }

    @GetMapping("/reservations/{token}")
    public String reservation(@PathVariable("token") String token, Model model) {
        ReservationResponse reservation;
        try {
            reservation = reservations.getReservationResponseByToken(token);
        } catch (ResourceNotFoundException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        }
        boolean active = reservation.status() == ReservationStatus.ACTIVE;
        model.addAttribute("reservation", reservation);
        model.addAttribute("active", active);
        model.addAttribute("expired", active && reservation.timeRemainingSeconds() <= 0);
        model.addAttribute("paymentMethods", PaymentMethod.values());
        // Uma chave por "sessão de pagamento": após uma falha, a mesma chave é reaproveitada (veja pay()).
        if (!model.containsAttribute("idempotencyKey")) {
            model.addAttribute("idempotencyKey", UUID.randomUUID().toString());
        }
        return "reservations/detail";
    }

    @PostMapping("/reservations/{token}/pay")
    public String pay(@PathVariable("token") String token,
                      @RequestParam("paymentMethod") PaymentMethod paymentMethod,
                      @RequestParam("idempotencyKey") String idempotencyKey,
                      RedirectAttributes redirect) {
        try {
            payments.processPayment(new PaymentRequest(token, paymentMethod, idempotencyKey));
        } catch (TicketingException ex) {
            redirect.addFlashAttribute("paymentError", ErrorMessages.translate(ex.getMessage()));
            redirect.addFlashAttribute("idempotencyKey", idempotencyKey);
        }
        return "redirect:/reservations/" + token;
    }

    @PostMapping("/reservations/{token}/cancel")
    public String cancel(@PathVariable("token") String token, RedirectAttributes redirect) {
        try {
            reservations.releaseReservation(token);
            redirect.addFlashAttribute("cancelled", true);
        } catch (TicketingException ex) {
            redirect.addFlashAttribute("cancelError", true);
        }
        return "redirect:/reservations/" + token;
    }

    private static Map<String, List<SeatResponse>> groupBySection(List<SeatResponse> seats) {
        Map<String, List<SeatResponse>> groups = new LinkedHashMap<>();
        for (SeatResponse seat : seats) {
            groups.computeIfAbsent(seat.section() == null ? "Geral" : seat.section(), k -> new java.util.ArrayList<>())
                    .add(seat);
        }
        return groups;
    }
}
