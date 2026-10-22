package com.ticketing.domain;

public enum ReservationStatus {
    ACTIVE("Ativa"),
    COMPLETED("Paga"),
    EXPIRED("Expirada"),
    CANCELLED("Cancelada");

    private final String label;

    ReservationStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
