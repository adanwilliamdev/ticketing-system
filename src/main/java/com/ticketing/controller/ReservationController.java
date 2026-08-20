package com.ticketing.controller;

import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.service.ReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/reservations")
@Slf4j
@RequiredArgsConstructor
public class ReservationController {
    
    private final ReservationService reservationService;
    
    @PostMapping
    public ResponseEntity<ReservationResponse> createReservation(
            @Valid @RequestBody CreateReservationRequest request) {
        log.info("Creating reservation for event: {}, seat: {}", 
            request.getEventId(), request.getSeatNumber());
        
        ReservationResponse response = reservationService.createReservation(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    
    @GetMapping("/{token}")
    public ResponseEntity<ReservationResponse> getReservation(@PathVariable String token) {
        log.info("Getting reservation: {}", token);
        
        ReservationResponse response = reservationService.getReservationResponseByToken(token);
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/{token}/confirm")
    public ResponseEntity<ReservationResponse> confirmReservation(@PathVariable String token) {
        log.info("Confirming reservation: {}", token);
        
        ReservationResponse response = reservationService.confirmReservation(token);
        return ResponseEntity.ok(response);
    }
    
    @DeleteMapping("/{token}")
    public ResponseEntity<Void> cancelReservation(@PathVariable String token) {
        log.info("Cancelling reservation: {}", token);
        
        reservationService.releaseReservation(token);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/{token}/validate")
    public ResponseEntity<Boolean> validateReservation(@PathVariable String token) {
        boolean isValid = reservationService.isReservationValid(token);
        return ResponseEntity.ok(isValid);
    }
}
