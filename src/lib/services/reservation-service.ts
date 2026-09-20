import type { Database, Queryable } from '../db-types';
import { toReservationResponse, type ReservationResponse } from '../dto';
import { BusinessError, ResourceNotFoundError } from '../errors';
import type { LockManager } from '../lock';
import { log } from '../logger';
import type { Repositories } from '../repositories';
import { isReservationExpired, type Reservation } from '../types';
import type { CreateReservationRequest } from '../validation';

export interface ReservationService {
  createReservation(request: CreateReservationRequest): Promise<ReservationResponse>;
  getReservationByToken(token: string): Promise<Reservation>;
  getReservationResponseByToken(token: string): Promise<ReservationResponse>;
  confirmReservation(token: string): Promise<ReservationResponse>;
  /** Libera todas as reservas ACTIVE vencidas; devolve quantas foram liberadas. */
  expireReservations(): Promise<number>;
  releaseReservation(token: string): Promise<void>;
  isReservationValid(token: string): Promise<boolean>;
}

export interface ReservationServiceDeps {
  db: Database;
  repos: Repositories;
  locks: LockManager;
  generateToken: () => string;
  now: () => Date;
  reservationTimeoutMinutes: number;
}

// Mesmos tempos do original (tryLock(wait, lease)).
const CREATE_LOCK = { waitMs: 5_000, leaseMs: 10_000 };
const RELEASE_LOCK = { waitMs: 5_000, leaseMs: 5_000 };
const CONFIRM_EXTENSION_MINUTES = 5;

/**
 * Devolve o assento e a vaga do evento e cancela a reserva — se ela ainda estiver ACTIVE.
 * Deve rodar dentro de uma transação. Ordem fixa de locks (evento → assento → reserva), a mesma
 * usada em createReservation e no pagamento, para que transações concorrentes nunca se travem em ciclo.
 * A reserva é relida já com lock: quem chamou pode ter uma versão desatualizada (ex.: um pagamento
 * concluiu enquanto o job de expiração esperava).
 */
export async function releaseActiveReservation(repos: Repositories, tx: Queryable, reservation: Reservation): Promise<boolean> {
  await repos.events.findByIdForUpdate(tx, reservation.eventId);
  await repos.tickets.findByIdForUpdate(tx, reservation.ticketId);
  const current = await repos.reservations.findByIdForUpdate(tx, reservation.id);
  if (!current || current.status !== 'ACTIVE') return false;

  await repos.tickets.updateStatus(tx, reservation.ticketId, 'AVAILABLE');
  await repos.events.incrementAvailable(tx, reservation.eventId);
  await repos.reservations.updateStatus(tx, reservation.id, 'CANCELLED');
  return true;
}

export function createReservationService(deps: ReservationServiceDeps): ReservationService {
  const { db, repos, locks } = deps;

  async function getReservationByToken(token: string): Promise<Reservation> {
    const reservation = await repos.reservations.findByToken(db.pool, token);
    if (!reservation) throw new ResourceNotFoundError('Reservation not found');
    return reservation;
  }

  async function createReservation(request: CreateReservationRequest): Promise<ReservationResponse> {
    const lockKey = `event:${request.eventId}:ticket:${request.seatNumber}`;

    // Ordem: lock distribuído → transação → COMMIT → libera o lock. (No original o lock era solto
    // antes do commit, porque o @Transactional envolvia o método inteiro.)
    const result = await locks.tryWithLock(lockKey, CREATE_LOCK, () =>
      db.transaction(async (tx) => {
        const event = await repos.events.findByIdForUpdate(tx, request.eventId);
        if (!event) throw new ResourceNotFoundError('Event not found');

        if (event.availableTickets <= 0) throw new BusinessError('No tickets available for this event');

        const ticket = await repos.tickets.findByEventAndSeatForUpdate(tx, request.eventId, request.seatNumber);
        if (!ticket) throw new ResourceNotFoundError('Seat not found');

        if (ticket.status !== 'AVAILABLE') throw new BusinessError('Seat is not available');

        if (await repos.reservations.existsActiveForTicket(tx, ticket.id)) {
          throw new BusinessError('Seat already has an active reservation');
        }

        const now = deps.now();
        await repos.tickets.updateStatus(tx, ticket.id, 'RESERVED');
        await repos.events.decrementAvailable(tx, event.id);
        const reservation = await repos.reservations.insert(tx, {
          reservationToken: deps.generateToken(),
          eventId: event.id,
          ticketId: ticket.id,
          userId: request.userId,
          userEmail: request.userEmail,
          expiresAt: new Date(now.getTime() + deps.reservationTimeoutMinutes * 60_000),
        });

        log.info(`Reservation created successfully: ${reservation.reservationToken}`);
        return toReservationResponse(reservation, now);
      }),
    );

    if (!result.acquired) throw new BusinessError('Could not acquire lock for seat reservation');
    return result.value;
  }

  async function releaseReservation(token: string): Promise<void> {
    const reservation = await getReservationByToken(token);

    const result = await locks.tryWithLock(`reservation:${token}`, RELEASE_LOCK, () =>
      db.transaction((tx) => releaseActiveReservation(repos, tx, reservation)),
    );

    // Igual ao original: não conseguir o lock não é erro (quem o segura está mexendo na reserva).
    if (!result.acquired) log.warn(`Reservation ${token} not released: lock busy`);
    else if (result.value) log.info(`Reservation released: ${token}`);
  }

  async function expireReservations(): Promise<number> {
    const expired = await repos.reservations.findExpiredActive(db.pool, deps.now());
    log.info(`Found ${expired.length} expired reservations to process`);

    let released = 0;
    for (const reservation of expired) {
      try {
        await releaseReservation(reservation.reservationToken);
        released++;
      } catch (error) {
        log.error(`Error processing expired reservation: ${reservation.reservationToken}`, error);
      }
    }
    return released;
  }

  async function confirmReservation(token: string): Promise<ReservationResponse> {
    const reservation = await getReservationByToken(token);
    const now = deps.now();

    if (reservation.status !== 'ACTIVE') throw new BusinessError('Reservation is not active');
    if (isReservationExpired(reservation, now)) throw new BusinessError('Reservation has expired');

    // Comportamento herdado: a nova expiração é "agora + 5 min" (pode até ser menor que a atual).
    const expiresAt = new Date(now.getTime() + CONFIRM_EXTENSION_MINUTES * 60_000);
    const updated = await repos.reservations.updateExpiresAt(db.pool, reservation.id, expiresAt);
    if (!updated) throw new BusinessError('Reservation is not active');

    return toReservationResponse({ ...reservation, expiresAt }, now);
  }

  async function getReservationResponseByToken(token: string): Promise<ReservationResponse> {
    return toReservationResponse(await getReservationByToken(token), deps.now());
  }

  async function isReservationValid(token: string): Promise<boolean> {
    try {
      const reservation = await getReservationByToken(token);
      return reservation.status === 'ACTIVE' && !isReservationExpired(reservation, deps.now());
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return false;
      throw error;
    }
  }

  return {
    createReservation,
    getReservationByToken,
    getReservationResponseByToken,
    confirmReservation,
    expireReservations,
    releaseReservation,
    isReservationValid,
  };
}
