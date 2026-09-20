import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { sleep } from '../src/lib/async';
import { BusinessError, DuplicatePaymentError, ResourceNotFoundError } from '../src/lib/errors';
import type { PaymentGateway } from '../src/lib/payment-gateway';
import type { PaymentRequest } from '../src/lib/validation';
import { busyLocks, createHarness, type Harness } from './helpers/fakes';

const chargeCount = (h: Harness): number => (h.gateway as unknown as { charges: number }).charges;

const paymentRequest: PaymentRequest = { reservationToken: 'res-token-123', paymentMethod: 'PIX', idempotencyKey: 'idem-key-123' };

function setup(h: Harness) {
  const event = h.store.addEvent({ availableTickets: 9, price: '150.00' });
  const ticket = h.store.addTicket(event.id, 'A001', { status: 'RESERVED' });
  const reservation = h.store.addReservation(ticket, { reservationToken: 'res-token-123' });
  return { event, ticket, reservation };
}

describe('PaymentService', () => {
  let h: Harness;
  beforeEach(() => { h = createHarness(); });

  describe('processPayment', () => {
    it('processa com sucesso', async () => {
      const { ticket, reservation } = setup(h);
      const payment = await h.payments.processPayment(paymentRequest);

      assert.equal(payment.status, 'COMPLETED');
      assert.equal(Number(payment.amount), 150);
      assert.equal(payment.currency, 'BRL');
      assert.equal(payment.paymentMethod, 'PIX');
      assert.ok(payment.completedAt);
      assert.equal(ticket.status, 'SOLD');
      assert.equal(reservation.status, 'COMPLETED');
      assert.equal(h.store.payments.size, 1);
      assert.deepEqual(h.lockStore.heldKeys, []);
    });

    it('falha com pagamento duplicado (mesma chave de idempotência) sem tocar na reserva', async () => {
      setup(h);
      await h.payments.processPayment(paymentRequest);
      h.store.calls.length = 0;

      await assert.rejects(h.payments.processPayment(paymentRequest), (e) => e instanceof DuplicatePaymentError && /already processed/.test(e.message));
      assert.equal(h.store.calls.includes('reservations.findByToken'), false);
      assert.equal(chargeCount(h), 1, 'só uma cobrança');
    });

    it('falha quando a reserva é inválida ou expirada, sem salvar pagamento', async () => {
      const { reservation } = setup(h);
      reservation.expiresAt = new Date(Date.now() - 1000);
      await assert.rejects(h.payments.processPayment(paymentRequest), (e) => e instanceof BusinessError && /Invalid or expired reservation/.test(e.message));
      assert.equal(h.store.payments.size, 0);
    });

    it('falha quando a reserva não existe (400, não 404 — como no original)', async () => {
      await assert.rejects(h.payments.processPayment(paymentRequest), (e) => e instanceof BusinessError && /Invalid or expired reservation/.test(e.message));
    });

    it('falha no gateway: grava FAILED, libera o assento e devolve o ingresso ao evento — tudo persistido', async () => {
      const failing: PaymentGateway = { async charge() { throw new Error('gateway indisponivel'); } };
      h = createHarness({ gateway: failing });
      const { event, ticket, reservation } = setup(h);

      await assert.rejects(h.payments.processPayment(paymentRequest), (e) => e instanceof BusinessError && /Payment processing failed: gateway indisponivel/.test(e.message));

      const [payment] = [...h.store.payments.values()];
      assert.equal(payment!.status, 'FAILED');
      assert.equal(payment!.failureReason, 'gateway indisponivel');
      assert.equal(reservation.status, 'CANCELLED');
      assert.equal(ticket.status, 'AVAILABLE');
      assert.equal(event.availableTickets, 10);
      assert.deepEqual(h.lockStore.heldKeys, []);
    });

    it('após falha no gateway a mesma chave de idempotência é rejeitada como duplicada (nova tentativa exige nova chave)', async () => {
      h = createHarness({ gateway: { async charge() { throw new Error('recusado'); } } });
      setup(h);
      await assert.rejects(h.payments.processPayment(paymentRequest), BusinessError);
      await assert.rejects(h.payments.processPayment(paymentRequest), DuplicatePaymentError);
    });

    it('falha quando não consegue adquirir o lock de pagamento, sem consultar idempotência', async () => {
      h = createHarness({ locks: busyLocks((k) => k.startsWith('payment:')) });
      setup(h);
      await assert.rejects(h.payments.processPayment(paymentRequest), (e) => e instanceof BusinessError && /Could not acquire lock for payment/.test(e.message));
      assert.equal(h.store.calls.includes('payments.findByIdempotencyKey'), false);
    });

    it('falha quando não consegue adquirir o lock da reserva, sem cobrar', async () => {
      h = createHarness({ locks: busyLocks((k) => k.startsWith('reservation:')) });
      setup(h);
      await assert.rejects(h.payments.processPayment(paymentRequest), (e) => e instanceof BusinessError && /Could not acquire lock for reservation/.test(e.message));
      assert.equal(chargeCount(h), 0);
    });
  });

  describe('concorrência', () => {
    it('duas requisições simultâneas com a mesma chave: uma conclui, a outra recebe Duplicate', async () => {
      h = createHarness({ gateway: { async charge() { await sleep(30); } } });
      setup(h);
      const results = await Promise.allSettled([h.payments.processPayment(paymentRequest), h.payments.processPayment(paymentRequest)]);

      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      assert.ok(rejected.reason instanceof DuplicatePaymentError);
      assert.equal(h.store.payments.size, 1);
    });

    it('chaves diferentes para a mesma reserva: só uma cobrança (a segunda vê a reserva já concluída)', async () => {
      const charges: string[] = [];
      h = createHarness({ gateway: { async charge(c) { charges.push(c.paymentId); await sleep(30); } } });
      const { ticket } = setup(h);
      const results = await Promise.allSettled([
        h.payments.processPayment({ ...paymentRequest, idempotencyKey: 'k1' }),
        h.payments.processPayment({ ...paymentRequest, idempotencyKey: 'k2' }),
      ]);

      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      assert.ok(rejected.reason instanceof BusinessError && /Invalid or expired reservation/.test(rejected.reason.message));
      assert.equal(charges.length, 1, 'o cliente não pode ser cobrado duas vezes');
      assert.equal(ticket.status, 'SOLD');
    });

    it('pagamento em andamento segura o lock: o job de expiração não libera uma reserva que está sendo paga', async () => {
      h = createHarness({ gateway: { async charge() { await sleep(60); } } });
      const { ticket, reservation } = setup(h);
      reservation.expiresAt = new Date(Date.now() + 20); // vence durante a cobrança

      const paying = h.payments.processPayment(paymentRequest);
      await sleep(30); // cobrança em curso, reserva já vencida
      h.clock.current = new Date(Date.now() + 60_000);
      await h.reservations.releaseReservation('res-token-123'); // espera o lock; ao entrar, a reserva já está COMPLETED
      await paying;

      assert.equal(reservation.status, 'COMPLETED');
      assert.equal(ticket.status, 'SOLD');
    });
  });

  describe('consultas', () => {
    it('getPaymentByIdempotencyKey devolve o pagamento quando existe', async () => {
      setup(h);
      const created = await h.payments.processPayment(paymentRequest);
      assert.equal((await h.payments.getPaymentByIdempotencyKey('idem-key-123')).id, created.id);
    });
    it('getPaymentByIdempotencyKey falha quando não existe', async () => {
      await assert.rejects(h.payments.getPaymentByIdempotencyKey('inexistente'), ResourceNotFoundError);
    });
    it('getPaymentByReservationToken devolve o pagamento associado', async () => {
      setup(h);
      const created = await h.payments.processPayment(paymentRequest);
      assert.equal((await h.payments.getPaymentByReservationToken('res-token-123')).id, created.id);
    });
    it('getPaymentByReservationToken falha com 404 sem pagamento', async () => {
      setup(h);
      await assert.rejects(h.payments.getPaymentByReservationToken('res-token-123'), (e) => e instanceof ResourceNotFoundError && /Payment not found/.test(e.message));
    });
  });
});
