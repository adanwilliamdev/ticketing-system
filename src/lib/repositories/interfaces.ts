// Equivalentes às interfaces JpaRepository. Os métodos *ForUpdate correspondem aos
// @Lock(PESSIMISTIC_WRITE) → SELECT ... FOR UPDATE.
import type { Queryable } from '../db-types';
import type { Event, NewPayment, NewReservation, Payment, Reservation, ReservationStatus, Ticket, TicketStatus } from '../types';

export interface EventRepository {
  findById(q: Queryable, id: number): Promise<Event | null>;
  findByIdForUpdate(q: Queryable, id: number): Promise<Event | null>;
  findAvailable(q: Queryable): Promise<Event[]>;
  decrementAvailable(q: Queryable, id: number): Promise<void>;
  incrementAvailable(q: Queryable, id: number): Promise<void>;
}

export interface TicketRepository {
  findByIdForUpdate(q: Queryable, id: number): Promise<Ticket | null>;
  findByEventAndSeatForUpdate(q: Queryable, eventId: number, seatNumber: string): Promise<Ticket | null>;
  listByEvent(q: Queryable, eventId: number): Promise<Ticket[]>;
  updateStatus(q: Queryable, id: number, status: TicketStatus): Promise<void>;
}

export interface ReservationRepository {
  findByToken(q: Queryable, token: string): Promise<Reservation | null>;
  findByIdForUpdate(q: Queryable, id: number): Promise<Reservation | null>;
  existsActiveForTicket(q: Queryable, ticketId: number): Promise<boolean>;
  insert(q: Queryable, reservation: NewReservation): Promise<Reservation>;
  updateStatus(q: Queryable, id: number, status: ReservationStatus): Promise<void>;
  /** Só atualiza se a reserva ainda estiver ACTIVE; devolve se atualizou. */
  updateExpiresAt(q: Queryable, id: number, expiresAt: Date): Promise<boolean>;
  findExpiredActive(q: Queryable, now: Date): Promise<Reservation[]>;
}

export interface PaymentRepository {
  findByIdempotencyKey(q: Queryable, key: string): Promise<Payment | null>;
  findByReservationId(q: Queryable, reservationId: number): Promise<Payment | null>;
  insert(q: Queryable, payment: NewPayment): Promise<Payment>;
}

export interface Repositories {
  events: EventRepository;
  tickets: TicketRepository;
  reservations: ReservationRepository;
  payments: PaymentRepository;
}
