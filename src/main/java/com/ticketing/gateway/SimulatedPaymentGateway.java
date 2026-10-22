package com.ticketing.gateway;

import com.ticketing.config.TicketingProperties;
import org.springframework.stereotype.Component;

/** Gateway simulado: só espera (padrão 2s) e aprova. */
@Component
public class SimulatedPaymentGateway implements PaymentGateway {

    private final long delayMs;

    public SimulatedPaymentGateway(TicketingProperties properties) {
        this.delayMs = properties.paymentGatewayDelayMs();
    }

    @Override
    public void charge(GatewayCharge charge) {
        if (delayMs <= 0) {
            return;
        }
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Payment gateway call interrupted", e);
        }
    }
}
