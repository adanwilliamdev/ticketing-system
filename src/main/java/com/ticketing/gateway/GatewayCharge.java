package com.ticketing.gateway;

import java.math.BigDecimal;

public record GatewayCharge(String paymentId, BigDecimal amount, String currency, String method,
                            String reservationToken) {
}
