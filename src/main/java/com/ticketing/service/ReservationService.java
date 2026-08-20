package com.ticketing.service;

import com.ticketing.dto.CreateReservationRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.entity.Reservation;

public interface ReservationService {
    ReservationResponse createReservation(CreateReservationRequest request);
    Reservation getReservationByToken(String token);
    ReservationResponse getReservationResponseByToken(String token);
    ReservationResponse confirmReservation(String token);
    void expireReservations();
    void releaseReservation(String token);
    boolean isReservationValid(String token);
}
