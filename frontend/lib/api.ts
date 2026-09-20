// Cliente HTTP para o backend FastAPI. Equivalente a lib/client/*.ts do projeto original.
import { translateApiMessage } from '@/lib/messages';
import type {
  ApiErrorBody,
  CreateReservationInput,
  EventSummary,
  Payment,
  PaymentInput,
  Reservation,
  Seat,
} from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(body: ApiErrorBody) {
    super(translateApiMessage(body.message));
    this.name = 'ApiError';
    this.status = body.status;
    this.details = body.details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = { timestamp: new Date().toISOString(), status: response.status, error: 'Error', message: response.statusText };
    }
    throw new ApiError(body);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  listEvents: () => request<EventSummary[]>('/api/events'),
  getEvent: (eventId: number) => request<EventSummary>(`/api/events/${eventId}`),
  listSeats: (eventId: number) => request<Seat[]>(`/api/events/${eventId}/seats`),

  createReservation: (input: CreateReservationInput) =>
    request<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(input) }),
  getReservation: (token: string) => request<Reservation>(`/api/reservations/${token}`),
  cancelReservation: (token: string) => request<void>(`/api/reservations/${token}`, { method: 'DELETE' }),
  confirmReservation: (token: string) => request<Reservation>(`/api/reservations/${token}/confirm`, { method: 'POST' }),
  validateReservation: (token: string) => request<boolean>(`/api/reservations/${token}/validate`),

  pay: (input: PaymentInput) => request<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(input) }),
  getPaymentByReservation: (token: string) => request<Payment>(`/api/payments/reservation/${token}`),
};

export function generateIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
