package com.ticketing.gateway;

/**
 * Fronteira com o gateway de pagamento. Lançar exceção significa cobrança recusada/falha.
 * Ao integrar um gateway real, nunca registre em log nem persista dados de cartão.
 */
public interface PaymentGateway {

    void charge(GatewayCharge charge);
}
