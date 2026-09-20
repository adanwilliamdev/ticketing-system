// Cliente da API REST usado pelas páginas (roda no navegador).
import type { EventResponse, PaymentResponse, ReservationResponse, SeatResponse } from '@/lib/dto';
import type { PaymentMethod } from '@/lib/types';
import { translateApiMessage } from './messages';

export class ApiError extends Error {
  readonly status: number;
  readonly rawMessage: string;

  constructor(rawMessage: string, status: number) {
    super(translateApiMessage(rawMessage));
    this.name = 'ApiError';
    this.status = status;
    this.rawMessage = rawMessage;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK', 0);
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; details?: Record<string, string> };
      const first = body.details ? Object.values(body.details)[0] : undefined;
      message = first ?? body.message ?? message;
    } catch {
      // resposta sem JSON: mantém a mensagem genérica
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listEvents: () => request<EventResponse[]>('/api/events'),
  getEvent: (id: number) => request<EventResponse>(`/api/events/${id}`),
  listSeats: (eventId: number) => request<SeatResponse[]>(`/api/events/${eventId}/seats`),

  createReservation: (body: { eventId: number; seatNumber: string; userEmail?: string }) =>
    request<ReservationResponse>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  getReservation: (token: string) => request<ReservationResponse>(`/api/reservations/${encodeURIComponent(token)}`),
  cancelReservation: (token: string) => request<void>(`/api/reservations/${encodeURIComponent(token)}`, { method: 'DELETE' }),

  pay: (body: { reservationToken: string; paymentMethod: PaymentMethod; idempotencyKey: string }) =>
    request<PaymentResponse>('/api/payments', { method: 'POST', body: JSON.stringify(body) }),
  getPaymentByKey: (key: string) => request<PaymentResponse>(`/api/payments/idempotency/${encodeURIComponent(key)}`),
};

/** Chave de idempotência aleatória. Usa getRandomValues, que também funciona fora de contextos seguros (http em rede local). */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
