"""Equivalentes às exceções do pacote com.ticketing.exception (errors.ts)."""


class BusinessError(Exception):
    """Regra de negócio violada -> HTTP 400."""


class ResourceNotFoundError(Exception):
    """Recurso inexistente -> HTTP 404."""


class DuplicatePaymentError(Exception):
    """Chave de idempotência já usada -> HTTP 409."""


class ValidationAppError(Exception):
    """Corpo da requisição inválido -> HTTP 400 com `details` por campo."""

    def __init__(self, details: dict[str, str], message: str = "Validation failed") -> None:
        super().__init__(message)
        self.details = details
