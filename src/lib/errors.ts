// Equivalentes às exceções do pacote com.ticketing.exception.

/** Regra de negócio violada → HTTP 400. */
export class BusinessError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BusinessError';
  }
}

/** Recurso inexistente → HTTP 404. */
export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

/** Chave de idempotência já usada → HTTP 409. */
export class DuplicatePaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicatePaymentError';
  }
}

/** Corpo da requisição inválido → HTTP 400 com `details` por campo. */
export class ValidationError extends Error {
  readonly details: Record<string, string>;

  constructor(details: Record<string, string>, message = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}
