// Equivalente às anotações Bean Validation (@NotNull, @Email) dos DTOs, com as mesmas mensagens.
import { ValidationError } from './errors';
import { PAYMENT_METHODS, type PaymentMethod } from './types';

export interface CreateReservationRequest {
  eventId: number;
  seatNumber: string;
  userEmail: string | null;
  userId: string | null;
}

export interface PaymentRequest {
  reservationToken: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ValidationError({ body: 'Request body must be a JSON object' });
  }
  return input as Record<string, unknown>;
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

function requiredString(body: Record<string, unknown>, field: string, requiredMessage: string, maxLength: number, errors: Record<string, string>): string {
  const value = body[field];
  if (isMissing(value) || (typeof value === 'string' && value.trim() === '')) {
    errors[field] = requiredMessage;
    return '';
  }
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a string`;
    return '';
  }
  if (value.length > maxLength) {
    errors[field] = `${field} must be at most ${maxLength} characters`;
    return '';
  }
  return value;
}

function optionalString(body: Record<string, unknown>, field: string, maxLength: number, errors: Record<string, string>): string | null {
  const value = body[field];
  if (isMissing(value)) return null;
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a string`;
    return null;
  }
  if (value.length > maxLength) {
    errors[field] = `${field} must be at most ${maxLength} characters`;
    return null;
  }
  return value;
}

export function parseCreateReservation(input: unknown): CreateReservationRequest {
  const body = asObject(input);
  const errors: Record<string, string> = {};

  let eventId = 0;
  const rawEventId = body.eventId;
  if (isMissing(rawEventId)) {
    errors.eventId = 'Event ID is required';
  } else {
    const parsed = typeof rawEventId === 'string' && /^\d+$/.test(rawEventId) ? Number(rawEventId) : rawEventId;
    if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed <= 0) {
      errors.eventId = 'Event ID must be a positive integer';
    } else {
      eventId = parsed;
    }
  }

  const seatNumber = requiredString(body, 'seatNumber', 'Seat number is required', 50, errors);

  let userEmail = optionalString(body, 'userEmail', 255, errors);
  if (userEmail !== null && userEmail !== '' && !EMAIL.test(userEmail)) {
    errors.userEmail = 'Invalid email format';
  }
  if (userEmail === '') userEmail = null;

  const userId = optionalString(body, 'userId', 100, errors);

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { eventId, seatNumber, userEmail, userId };
}

export function parsePaymentRequest(input: unknown): PaymentRequest {
  const body = asObject(input);
  const errors: Record<string, string> = {};

  const reservationToken = requiredString(body, 'reservationToken', 'Reservation token is required', 64, errors);
  const idempotencyKey = requiredString(body, 'idempotencyKey', 'Idempotency key is required', 255, errors);

  let paymentMethod: PaymentMethod = 'PIX';
  const rawMethod = body.paymentMethod;
  if (isMissing(rawMethod)) {
    errors.paymentMethod = 'Payment method is required';
  } else if (typeof rawMethod !== 'string' || !(PAYMENT_METHODS as readonly string[]).includes(rawMethod)) {
    errors.paymentMethod = `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`;
  } else {
    paymentMethod = rawMethod as PaymentMethod;
  }

  // cardNumber, cardExpiry, cardCvv e cardHolderName eram aceitos e ignorados no projeto original
  // (o gateway é simulado). Aqui são descartados de propósito: dados de cartão nunca devem ser
  // persistidos nem logados por este serviço.

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { reservationToken, paymentMethod, idempotencyKey };
}

/** Converte um segmento de rota em id numérico; qualquer coisa inválida vira "não encontrado". */
export function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
