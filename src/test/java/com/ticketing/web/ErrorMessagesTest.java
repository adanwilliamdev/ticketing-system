package com.ticketing.web;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ErrorMessagesTest {

    @Test
    void translatesKnownMessages() {
        assertEquals("Este assento não está mais disponível.", ErrorMessages.translate("Seat is not available"));
        assertEquals("Este pagamento já foi processado.", ErrorMessages.translate("Payment already processed"));
    }

    @Test
    void translatesGatewayFailuresByPrefix() {
        assertEquals("O pagamento foi recusado pela operadora. Tente novamente ou use outro método.",
                ErrorMessages.translate("Payment processing failed: timeout"));
    }

    @Test
    void keepsUnknownMessagesAsIs() {
        assertEquals("Algo inesperado", ErrorMessages.translate("Algo inesperado"));
    }
}
