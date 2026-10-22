package com.ticketing.domain;

public enum PaymentMethod {
    PIX("Pix"),
    CREDIT_CARD("Cartão de crédito"),
    DEBIT_CARD("Cartão de débito"),
    BOLETO("Boleto"),
    PAYPAL("PayPal");

    private final String label;

    PaymentMethod(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
