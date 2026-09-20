// Tipos de domínio — equivalentes às entidades JPA do projeto Java (Event, Ticket, Reservation, Payment).
// Datas são sempre `Date` em UTC; valores monetários ficam como string (NUMERIC do Postgres) para não
// perder precisão — a conversão para número só acontece na fronteira da API (ver dto.ts).

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ONGOING', 'CANCELLED', 'COMPLETED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const TICKET_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD', 'CANCELLED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const RESERVATION_STATUSES = ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'PAYPAL'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Event {
  id: number;
  name: string;
  description: string | null;
  startDateTime: Date;
  endDateTime: Date;
  location: string | null;
  totalCapacity: number;
  availableTickets: number;
  price: string;
  status: EventStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: number;
  eventId: number;
  seatNumber: string;
  section: string | null;
  rowNumber: string | null;
  status: TicketStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Reserva já "achatada" com os dados de evento e assento que a API sempre precisa devolver. */
export interface Reservation {
  id: number;
  reservationToken: string;
  eventId: number;
  ticketId: number;
  userId: string | null;
  userEmail: string | null;
  expiresAt: Date;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
  eventName: string;
  eventPrice: string;
  seatNumber: string;
}

export interface Payment {
  id: number;
  paymentId: string | null;
  idempotencyKey: string;
  reservationId: number;
  ticketId: number;
  amount: string;
  currency: string | null;
  status: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  transactionId: string | null;
  failureReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewReservation {
  reservationToken: string;
  eventId: number;
  ticketId: number;
  userId: string | null;
  userEmail: string | null;
  expiresAt: Date;
}

export interface NewPayment {
  paymentId: string;
  idempotencyKey: string;
  reservationId: number;
  ticketId: number;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  failureReason: string | null;
  completedAt: Date | null;
}

/** Equivale a `Reservation.isExpired()`: expirada quando "agora" está estritamente depois de expiresAt. */
export function isReservationExpired(reservation: Pick<Reservation, 'expiresAt'>, now: Date): boolean {
  return now.getTime() > reservation.expiresAt.getTime();
}
