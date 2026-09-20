import { sleep } from './async';
import type { PaymentMethod } from './types';

export interface GatewayCharge {
  paymentId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reservationToken: string;
}

/**
 * Fronteira com o gateway de pagamento. Lançar exceção = cobrança recusada/falhou.
 * Ao integrar um gateway real, nunca registre em log nem persista dados de cartão.
 */
export interface PaymentGateway {
  charge(charge: GatewayCharge): Promise<void>;
}

/** Equivalente a processPaymentWithGateway() do original: só espera (padrão 2s) e aprova. */
export function createSimulatedGateway(delayMs: number): PaymentGateway {
  return {
    async charge() {
      if (delayMs > 0) await sleep(delayMs);
    },
  };
}
