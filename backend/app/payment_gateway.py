"""Fronteira com o gateway de pagamento. Lançar exceção = cobrança recusada/falhou.

Ao integrar um gateway real, nunca registre em log nem persista dados de cartão.
Equivalente a payment-gateway.ts.
"""
import asyncio
from dataclasses import dataclass
from typing import Protocol


@dataclass
class GatewayCharge:
    payment_id: str
    amount: str
    currency: str
    method: str
    reservation_token: str


class PaymentGateway(Protocol):
    async def charge(self, charge: GatewayCharge) -> None: ...


class SimulatedGateway:
    """Equivalente a processPaymentWithGateway() do original: só espera (padrão 2s) e aprova."""

    def __init__(self, delay_ms: int) -> None:
        self._delay_ms = delay_ms

    async def charge(self, charge: GatewayCharge) -> None:
        if self._delay_ms > 0:
            await asyncio.sleep(self._delay_ms / 1000)
