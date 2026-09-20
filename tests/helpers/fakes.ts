// Dublês em memória para testar serviços sem Postgres/Redis.
// O FakeDatabase faz snapshot/restore no rollback — suficiente para testes sequenciais;
// nos testes concorrentes as transações são serializadas pelo lock, então não há sobreposição.
process.env.LOG_LEVEL = 'silent';

import type { Database, Queryable } from '../../src/lib/db-types';
import { DuplicatePaymentError } from '../../src/lib/errors';
import { RedisLockManager, type LockManager, type LockOptions, type LockResult, type LockStore } from '../../src/lib/lock';
import type { PaymentGateway } from '../../src/lib/payment-gateway';
import type { Repositories } from '../../src/lib/repositories';
import { createPaymentService } from '../../src/lib/services/payment-service';
import { createReservationService } from '../../src/lib/services/reservation-service';
import type { Event, Payment, Reservation, Ticket } from '../../src/lib/types';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

export class MemoryStore {
  events = new Map<number, Event>();
  tickets = new Map<number, Ticket>();
  reservations = new Map<number, Reservation>();
  payments = new Map<number, Payment>();
  private seq = 1;
  calls: string[] = [];
  /** Permite simular falha de um método de repositório: failOn['tickets.updateStatus'] = (args) => boolean */
  failOn: Record<string, (...args: unknown[]) => boolean> = {};

  nextId(): number {
    return this.seq++;
  }

  snapshot() {
    return structuredClone({ events: this.events, tickets: this.tickets, reservations: this.reservations, payments: this.payments });
  }

  restore(s: ReturnType<MemoryStore['snapshot']>) {
    this.events = s.events;
    this.tickets = s.tickets;
    this.reservations = s.reservations;
    this.payments = s.payments;
  }

  private hit(name: string, ...args: unknown[]) {
    this.calls.push(name);
    if (this.failOn[name]?.(...args)) throw new Error(`falha simulada em ${name}`);
  }

  // helpers de montagem de cenário
  addEvent(partial: Partial<Event> = {}): Event {
    const now = new Date();
    const event: Event = {
      id: this.nextId(), name: 'Rock Concert 2024', description: null, startDateTime: now, endDateTime: now, location: null,
      totalCapacity: 10, availableTickets: 10, price: '150.00', status: 'PUBLISHED', version: 0, createdAt: now, updatedAt: now, ...partial,
    };
    this.events.set(event.id, event);
    return event;
  }

  addTicket(eventId: number, seatNumber = 'A001', partial: Partial<Ticket> = {}): Ticket {
    const now = new Date();
    const ticket: Ticket = {
      id: this.nextId(), eventId, seatNumber, section: 'Regular', rowNumber: 'Row 1', status: 'AVAILABLE', version: 0, createdAt: now, updatedAt: now, ...partial,
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  addReservation(ticket: Ticket, partial: Partial<Reservation> = {}): Reservation {
    const event = this.events.get(ticket.eventId)!;
    const now = new Date();
    const reservation: Reservation = {
      id: this.nextId(), reservationToken: `token-${this.seq}`, eventId: event.id, ticketId: ticket.id, userId: null, userEmail: null,
      expiresAt: new Date(Date.now() + 5 * 60_000), status: 'ACTIVE', createdAt: now, updatedAt: now,
      eventName: event.name, eventPrice: event.price, seatNumber: ticket.seatNumber, ...partial,
    };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  repositories(): Repositories {
    const s = this;
    return {
      events: {
        async findById(_q, id) { await tick(); return s.events.get(id) ?? null; },
        async findByIdForUpdate(_q, id) { s.hit('events.findByIdForUpdate', id); await tick(); return s.events.get(id) ?? null; },
        async findAvailable() { return [...s.events.values()].filter((e) => e.availableTickets > 0 && e.status === 'PUBLISHED'); },
        async decrementAvailable(_q, id) { s.hit('events.decrementAvailable', id); await tick(); s.events.get(id)!.availableTickets--; },
        async incrementAvailable(_q, id) { s.hit('events.incrementAvailable', id); await tick(); s.events.get(id)!.availableTickets++; },
      },
      tickets: {
        async findByIdForUpdate(_q, id) { await tick(); return s.tickets.get(id) ?? null; },
        async findByEventAndSeatForUpdate(_q, eventId, seat) {
          s.hit('tickets.findByEventAndSeatForUpdate', eventId, seat); await tick();
          return [...s.tickets.values()].find((t) => t.eventId === eventId && t.seatNumber === seat) ?? null;
        },
        async listByEvent(_q, eventId) { return [...s.tickets.values()].filter((t) => t.eventId === eventId); },
        async updateStatus(_q, id, status) { s.hit('tickets.updateStatus', id, status); await tick(); s.tickets.get(id)!.status = status; },
      },
      reservations: {
        async findByToken(_q, token) { s.hit('reservations.findByToken', token); await tick(); return [...s.reservations.values()].find((r) => r.reservationToken === token) ?? null; },
        async findByIdForUpdate(_q, id) { await tick(); return s.reservations.get(id) ?? null; },
        async existsActiveForTicket(_q, ticketId) { await tick(); return [...s.reservations.values()].some((r) => r.ticketId === ticketId && r.status === 'ACTIVE'); },
        async insert(_q, n) {
          await tick();
          // espelha o índice único parcial uk_reservations_active_ticket (V3)
          if ([...s.reservations.values()].some((r) => r.ticketId === n.ticketId && r.status === 'ACTIVE')) throw new Error('unique violation: uk_reservations_active_ticket');
          const event = s.events.get(n.eventId)!; const ticket = s.tickets.get(n.ticketId)!; const now = new Date();
          const r: Reservation = { id: s.nextId(), ...n, status: 'ACTIVE', createdAt: now, updatedAt: now, eventName: event.name, eventPrice: event.price, seatNumber: ticket.seatNumber };
          s.reservations.set(r.id, r);
          return r;
        },
        async updateStatus(_q, id, status) { await tick(); s.reservations.get(id)!.status = status; },
        async updateExpiresAt(_q, id, expiresAt) { await tick(); const r = s.reservations.get(id); if (!r || r.status !== 'ACTIVE') return false; r.expiresAt = expiresAt; return true; },
        async findExpiredActive(_q, now) { return [...s.reservations.values()].filter((r) => r.status === 'ACTIVE' && r.expiresAt.getTime() < now.getTime()); },
      },
      payments: {
        async findByIdempotencyKey(_q, key) { s.hit('payments.findByIdempotencyKey', key); await tick(); return [...s.payments.values()].find((p) => p.idempotencyKey === key) ?? null; },
        async findByReservationId(_q, id) { await tick(); return [...s.payments.values()].find((p) => p.reservationId === id) ?? null; },
        async insert(_q, n) {
          s.hit('payments.insert', n.status); await tick();
          if ([...s.payments.values()].some((p) => p.idempotencyKey === n.idempotencyKey)) throw new DuplicatePaymentError('Payment already processed');
          const now = new Date();
          const p: Payment = { id: s.nextId(), ...n, createdAt: now, updatedAt: now };
          s.payments.set(p.id, p);
          return p;
        },
      },
    };
  }
}

export function createFakeDatabase(store: MemoryStore): Database {
  const q: Queryable = { query: async () => ({ rows: [], rowCount: 0 }) };
  return {
    pool: q,
    async transaction(fn) {
      const snap = store.snapshot();
      try { return await fn(q); } catch (e) { store.restore(snap); throw e; }
    },
    async close() {},
  };
}

/** LockStore em memória com TTL — permite exercitar o RedisLockManager real. */
export class MemoryLockStore implements LockStore {
  private entries = new Map<string, { token: string; expiresAt: number }>();
  async setIfAbsent(key: string, token: string, ttlMs: number) {
    const cur = this.entries.get(key);
    if (cur && cur.expiresAt > Date.now()) return false;
    this.entries.set(key, { token, expiresAt: Date.now() + ttlMs });
    return true;
  }
  async deleteIfEquals(key: string, token: string) {
    if (this.entries.get(key)?.token !== token) return false;
    this.entries.delete(key);
    return true;
  }
  get heldKeys(): string[] { return [...this.entries.entries()].filter(([, v]) => v.expiresAt > Date.now()).map(([k]) => k); }
}

/** Lock que nunca é obtido nas chaves indicadas (simula "não conseguiu adquirir o lock") e é livre nas demais. */
export function busyLocks(isBusy: (key: string) => boolean): LockManager {
  return {
    async tryWithLock<T>(key: string, _o: LockOptions, fn: () => Promise<T>): Promise<LockResult<T>> {
      return isBusy(key) ? { acquired: false } : { acquired: true, value: await fn() };
    },
  };
}

export function instantGateway(): PaymentGateway & { charges: number } {
  const g = { charges: 0, async charge() { g.charges++; } };
  return g;
}

export interface Harness {
  store: MemoryStore;
  lockStore: MemoryLockStore;
  clock: { current: Date };
  reservations: ReturnType<typeof createReservationService>;
  payments: ReturnType<typeof createPaymentService>;
  repos: Repositories;
  gateway: PaymentGateway;
}

export function createHarness(options: { locks?: LockManager; gateway?: PaymentGateway; timeoutMinutes?: number } = {}): Harness {
  const store = new MemoryStore();
  const lockStore = new MemoryLockStore();
  const locks = options.locks ?? new RedisLockManager(lockStore);
  const db = createFakeDatabase(store);
  const repos = store.repositories();
  const clock = { current: new Date() };
  let tokenSeq = 0;
  let idSeq = 0;
  const now = () => new Date(clock.current.getTime());
  const reservations = createReservationService({
    db, repos, locks, now, generateToken: () => `token-abc-${++tokenSeq}`, reservationTimeoutMinutes: options.timeoutMinutes ?? 10,
  });
  const gateway = options.gateway ?? instantGateway();
  const payments = createPaymentService({ db, repos, reservations, locks, gateway, now, generateId: () => `pay-${++idSeq}` });
  return { store, lockStore, clock, reservations, payments, repos, gateway };
}
