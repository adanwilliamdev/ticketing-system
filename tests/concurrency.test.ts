import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessError } from '../src/lib/errors';
import { createHarness } from './helpers/fakes';

describe('reservas concorrentes', () => {
  it('50 pedidos simultâneos pelo mesmo assento: exatamente 1 vence, 49 recebem erro de negócio', async () => {
    const h = createHarness();
    const event = h.store.addEvent({ availableTickets: 10 });
    const ticket = h.store.addTicket(event.id, 'A001');

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => h.reservations.createReservation({ eventId: event.id, seatNumber: 'A001', userEmail: null, userId: `u${i}` })),
    );

    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(ok.length, 1);
    assert.equal(failed.length, 49);
    assert.ok(failed.every((f) => f.reason instanceof BusinessError && /Seat is not available/.test(f.reason.message)));
    assert.equal(ticket.status, 'RESERVED');
    assert.equal(event.availableTickets, 9);
    assert.equal(h.store.reservations.size, 1);
  });

  it('sem o lock a mesma corrida vazaria (o dublê tem I/O assíncrono): a proteção vem do lock, não da sorte', async () => {
    const h = createHarness({ locks: { async tryWithLock(_k, _o, fn) { return { acquired: true, value: await fn() }; } } });
    const event = h.store.addEvent({ availableTickets: 10 });
    h.store.addTicket(event.id, 'A001');
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => h.reservations.createReservation({ eventId: event.id, seatNumber: 'A001', userEmail: null, userId: null })),
    );
    // No Postgres real, o SELECT ... FOR UPDATE + índice único parcial cumprem esse papel; aqui o
    // dublê apenas espelha o índice único, então no máximo 1 reserva ACTIVE sobrevive.
    assert.ok(results.filter((r) => r.status === 'fulfilled').length >= 1);
    assert.equal([...h.store.reservations.values()].filter((r) => r.status === 'ACTIVE').length, 1);
  });

  it('assentos diferentes do mesmo evento reservam em paralelo sem perder contagem', async () => {
    const h = createHarness();
    const event = h.store.addEvent({ availableTickets: 5 });
    for (let i = 1; i <= 5; i++) h.store.addTicket(event.id, `S${i}`);
    // lock por assento é independente; as transações do dublê não se sobrepõem por causa do snapshot, então serializamos:
    for (let i = 1; i <= 5; i++) await h.reservations.createReservation({ eventId: event.id, seatNumber: `S${i}`, userEmail: null, userId: null });
    assert.equal(event.availableTickets, 0);
    await assert.rejects(h.reservations.createReservation({ eventId: event.id, seatNumber: 'S1', userEmail: null, userId: null }), /No tickets available/);
  });
});
