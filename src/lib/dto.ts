// Formas de resposta da API (equivalentes a ReservationResponse e às entidades serializadas)
// e os mapeadores de domínio → JSON. O front-end importa apenas os *tipos* deste arquivo.
import type { Event, EventStatus, Payment, PaymentMethod, PaymentStatus, Reservation, ReservationStatus, Ticket, TicketStatus } from './types';

export interface ReservationResponse {
  reservationToken: string;
  eventId: number;
  eventName: string;
  seatNumber: string;
  userEmail: string | null;
  expiresAt: string;
  status: ReservationStatus;
  timeRemainingSeconds: number;
}

export interface PaymentResponse {
  id: number;
  paymentId: string | null;
  idempotencyKey: string;
  reservationId: number;
  ticketId: number;
  amount: number;
  currency: string | null;
  status: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  transactionId: string | null;
  failureReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventResponse {
  id: number;
  name: string;
  description: string | null;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  totalCapacity: number;
  availableTickets: number;
  price: number;
  status: EventStatus;
}

export interface SeatResponse {
  id: number;
  seatNumber: string;
  section: string | null;
  rowNumber: string | null;
  status: TicketStatus;
}

export interface ErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  details?: Record<string, string>;
}

export function toReservationResponse(reservation: Reservation, now: Date): ReservationResponse {
  const remaining = Math.floor((reservation.expiresAt.getTime() - now.getTime()) / 1000);
  return {
    reservationToken: reservation.reservationToken,
    eventId: reservation.eventId,
    eventName: reservation.eventName,
    seatNumber: reservation.seatNumber,
    userEmail: reservation.userEmail,
    expiresAt: reservation.expiresAt.toISOString(),
    status: reservation.status,
    timeRemainingSeconds: Math.max(0, remaining),
  };
}

export function toPaymentResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.id,
    paymentId: payment.paymentId,
    idempotencyKey: payment.idempotencyKey,
    reservationId: payment.reservationId,
    ticketId: payment.ticketId,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
    failureReason: payment.failureReason,
    completedAt: payment.completedAt ? payment.completedAt.toISOString() : null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export function toEventResponse(event: Event): EventResponse {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startDateTime: event.startDateTime.toISOString(),
    endDateTime: event.endDateTime.toISOString(),
    location: event.location,
    totalCapacity: event.totalCapacity,
    availableTickets: event.availableTickets,
    price: Number(event.price),
    status: event.status,
  };
}

export function toSeatResponse(ticket: Ticket): SeatResponse {
  return {
    id: ticket.id,
    seatNumber: ticket.seatNumber,
    section: ticket.section,
    rowNumber: ticket.rowNumber,
    status: ticket.status,
  };
}
