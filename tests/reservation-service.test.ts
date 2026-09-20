import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BusinessError, ResourceNotFoundError } from '../src/lib/errors';
import type { CreateReservationRequest } from '../src/lib/validation';
import { busyLocks, createHarness, type Harness } from './helpers/fakes';

const request: CreateReservationRequest = { eventId: 0, seatNumber: 'A001', userEmail: 'user@example.com', userId: 'user-1' };

describe('ReservationService', () => {
  let h: Harness;
  let eventId: number;
  let ticketId: number;

  beforeEach(() => {
    h = createHarness();
    const event = h.store.addEvent({ availableTickets: 10 });
    const ticket = h.store.addTicket(event.id, 'A001');
    eventId = event.id;
    ticketId = ticket.id;
    request.eventId = eventId;
  });

  describe('createReservation', () => {
    it('cria com sucesso quando o assento está disponível', async () => {
      const res = await h.reservations.createReservation(request);

      assert.equal(res.reservationToken, 'token-abc-1');
      assert.equal(res.eventId, eventId);
      assert.equal(res.seatNumber, 'A001');
      assert.equal(res.status, 'ACTIVE');
      assert.ok(res.timeRemainingSeconds > 0 && res.timeRemainingSeconds <= 600);
      assert.equal(h.store.tickets.get(ticketId)!.status, 'RESERVED');
      assert.equal(h.store.events.get(eventId)!.availableTickets, 9);
      assert.deepEqual(h.lockStore.heldKeys, [], 'o lock deve ser liberado');
    });

    it('usa o prazo configurado (10 min por padrão)', async () => {
      const res = await h.reservations.createReservation(request);
      assert.equal(res.timeRemainingSeconds, 600);
    });

    it('falha quando o evento não existe', async () => {
      await assert.rejects(h.reservations.createReservation({ ...request, eventId: 999 }), (e) => e instanceof ResourceNotFoundError && /Event not found/.test(e.message));
    });

    it('falha quando o evento não tem ingressos disponíveis', async () => {
      h.store.events.get(eventId)!.availableTickets = 0;
      await assert.rejects(h.reservations.createReservation(request), (e) => e instanceof BusinessError && /No tickets available/.test(e.message));
      assert.equal(h.store.reservations.size, 0);
    });

    it('falha quando o assento não existe', async () => {
      await assert.rejects(h.reservations.createReservation({ ...request, seatNumber: 'Z999' }), (e) => e instanceof ResourceNotFoundError && /Seat not found/.test(e.message));
    });

    it('falha quando o assento já está reservado ou vendido', async () => {
      h.store.tickets.get(ticketId)!.status = 'SOLD';
      await assert.rejects(h.reservations.createReservation(request), (e) => e instanceof BusinessError && /Seat is not available/.test(e.message));
    });

    it('falha quando já existe reserva ativa para o assento', async () => {
      h.store.addReservation(h.store.tickets.get(ticketId)!); // estado inconsistente de propósito: assento AVAILABLE + reserva ACTIVE
      await assert.rejects(h.reservations.createReservation(request), (e) => e instanceof BusinessError && /already has an active reservation/.test(e.message));
    });

    it('falha quando não consegue adquirir o lock, sem tocar no banco', async () => {
      const busy = createHarness({ locks: busyLocks(() => true) });
      const ev = busy.store.addEvent();
      busy.store.addTicket(ev.id, 'A001');
      await assert.rejects(busy.reservations.createReservation({ ...request, eventId: ev.id }), (e) => e instanceof BusinessError && /Could not acquire lock/.test(e.message));
      assert.equal(busy.store.calls.includes('events.findByIdForUpdate'), false);
    });

    it('desfaz tudo se algo falha no meio da transação', async () => {
      h.store.failOn['events.decrementAvailable'] = () => true;
      await assert.rejects(h.reservations.createReservation(request), /falha simulada/);
      assert.equal(h.store.tickets.get(ticketId)!.status, 'AVAILABLE');
      assert.equal(h.store.reservations.size, 0);
      assert.deepEqual(h.lockStore.heldKeys, [], 'o lock deve ser liberado mesmo com erro');
    });

    it('permite reservar de novo um assento que foi liberado (o schema original impedia isso)', async () => {
      const first = await h.reservations.createReservation(request);
      await h.reservations.releaseReservation(first.reservationToken);
      const second = await h.reservations.createReservation(request);
      assert.equal(second.status, 'ACTIVE');
      assert.notEqual(second.reservationToken, first.reservationToken);
      assert.equal(h.store.events.get(eventId)!.availableTickets, 9);
    });
  });

  describe('releaseReservation', () => {
    it('libera o assento e incrementa os ingressos disponíveis', async () => {
      const created = await h.reservations.createReservation(request);
      await h.reservations.releaseReservation(created.reservationToken);

      assert.equal(h.store.tickets.get(ticketId)!.status, 'AVAILABLE');
      assert.equal(h.store.events.get(eventId)!.availableTickets, 10);
      assert.equal([...h.store.reservations.values()][0]!.status, 'CANCELLED');
    });

    it('falha com 404 quando a reserva não existe', async () => {
      await assert.rejects(h.reservations.releaseReservation('inexistente'), ResourceNotFoundError);
    });

    it('é idempotente: reserva que não está ACTIVE não mexe em assento nem contador', async () => {
      const created = await h.reservations.createReservation(request);
      const r = [...h.store.reservations.values()][0]!;
      r.status = 'COMPLETED';
      h.store.tickets.get(ticketId)!.status = 'SOLD';

      await h.reservations.releaseReservation(created.reservationToken);

      assert.equal(h.store.tickets.get(ticketId)!.status, 'SOLD');
      assert.equal(h.store.events.get(eventId)!.availableTickets, 9);
      assert.equal(r.status, 'COMPLETED');
    });

    it('não é erro quando o lock está ocupado (comportamento herdado): nada é alterado', async () => {
      const busy = createHarness({ locks: busyLocks((k) => k.startsWith('reservation:')) });
      const ev = busy.store.addEvent({ availableTickets: 9 });
      const t = busy.store.addTicket(ev.id, 'A001', { status: 'RESERVED' });
      const r = busy.store.addReservation(t, { reservationToken: 'tok' });
      await busy.reservations.releaseReservation('tok');
      assert.equal(r.status, 'ACTIVE');
      assert.equal(busy.store.events.get(ev.id)!.availableTickets, 9);
    });
  });

  describe('isReservationValid', () => {
    it('false quando a reserva não existe', async () => {
      assert.equal(await h.reservations.isReservationValid('inexistente'), false);
    });
    it('false quando a reserva está expirada', async () => {
      h.store.addReservation(h.store.tickets.get(ticketId)!, { reservationToken: 'exp', expiresAt: new Date(Date.now() - 60_000) });
      assert.equal(await h.reservations.isReservationValid('exp'), false);
    });
    it('true quando a reserva está ativa e não expirou', async () => {
      h.store.addReservation(h.store.tickets.get(ticketId)!, { reservationToken: 'ok' });
      assert.equal(await h.reservations.isReservationValid('ok'), true);
    });
  });

  describe('confirmReservation', () => {
    it('falha quando a reserva não está ativa', async () => {
      h.store.addReservation(h.store.tickets.get(ticketId)!, { reservationToken: 'c', status: 'CANCELLED' });
      await assert.rejects(h.reservations.confirmReservation('c'), (e) => e instanceof BusinessError && /not active/.test(e.message));
    });
    it('falha quando a reserva expirou', async () => {
      h.store.addReservation(h.store.tickets.get(ticketId)!, { reservationToken: 'e', expiresAt: new Date(Date.now() - 5_000) });
      await assert.rejects(h.reservations.confirmReservation('e'), (e) => e instanceof BusinessError && /expired/.test(e.message));
    });
    it('renova a expiração para ~5 minutos quando válida', async () => {
      h.store.addReservation(h.store.tickets.get(ticketId)!, { reservationToken: 'v', expiresAt: new Date(Date.now() + 60_000) });
      const res = await h.reservations.confirmReservation('v');
      assert.ok(res.timeRemainingSeconds > 200 && res.timeRemainingSeconds <= 300);
    });
  });

  describe('expireReservations', () => {
    it('libera todas as reservas vencidas e preserva as ativas', async () => {
      const ev = h.store.events.get(eventId)!;
      ev.availableTickets = 7;
      const t1 = h.store.addTicket(eventId, 'B1', { status: 'RESERVED' });
      const t2 = h.store.addTicket(eventId, 'B2', { status: 'RESERVED' });
      const t3 = h.store.addTicket(eventId, 'B3', { status: 'RESERVED' });
      const e1 = h.store.addReservation(t1, { reservationToken: 'e1', expiresAt: new Date(Date.now() - 60_000) });
      const e2 = h.store.addReservation(t2, { reservationToken: 'e2', expiresAt: new Date(Date.now() - 1_000) });
      const live = h.store.addReservation(t3, { reservationToken: 'live' });

      const released = await h.reservations.expireReservations();

      assert.equal(released, 2);
      assert.equal(e1.status, 'CANCELLED');
      assert.equal(e2.status, 'CANCELLED');
      assert.equal(live.status, 'ACTIVE');
      assert.equal(t1.status, 'AVAILABLE');
      assert.equal(t3.status, 'RESERVED');
      assert.equal(ev.availableTickets, 9);
    });

    it('um erro em uma reserva não impede as demais', async () => {
      const t1 = h.store.addTicket(eventId, 'B1', { status: 'RESERVED' });
      const t2 = h.store.addTicket(eventId, 'B2', { status: 'RESERVED' });
      h.store.addReservation(t1, { reservationToken: 'e1', expiresAt: new Date(Date.now() - 60_000) });
      const e2 = h.store.addReservation(t2, { reservationToken: 'e2', expiresAt: new Date(Date.now() - 60_000) });
      h.store.failOn['tickets.updateStatus'] = (id) => id === t1.id;

      const released = await h.reservations.expireReservations();

      assert.equal(released, 1);
      // o rollback do dublê recria os objetos: reler pelo id
      assert.equal(h.store.reservations.get(e2.id)!.status, 'CANCELLED');
      const e1 = [...h.store.reservations.values()].find((r) => r.reservationToken === 'e1')!;
      assert.equal(e1.status, 'ACTIVE', 'a que falhou foi revertida e será tentada de novo no próximo ciclo');
    });

    it('não devolve ao estoque uma reserva que foi paga enquanto o job esperava (o original sobrescrevia a venda)', async () => {
      const created = await h.reservations.createReservation(request);
      // o job leu a reserva como vencida...
      h.clock.current = new Date(Date.now() + 11 * 60_000);
      const expiredView = await h.repos.reservations.findExpiredActive(h.store as never, h.clock.current);
      assert.equal(expiredView.length, 1);
      // ...mas, antes de liberar, o pagamento concluiu:
      const r = [...h.store.reservations.values()][0]!;
      r.status = 'COMPLETED';
      h.store.tickets.get(ticketId)!.status = 'SOLD';

      await h.reservations.releaseReservation(created.reservationToken);

      assert.equal(h.store.tickets.get(ticketId)!.status, 'SOLD');
      assert.equal(r.status, 'COMPLETED');
    });
  });
});
