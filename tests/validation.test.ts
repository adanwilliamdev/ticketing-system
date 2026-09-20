import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../src/lib/errors';
import { parseCreateReservation, parseId, parsePaymentRequest } from '../src/lib/validation';

function details(fn: () => unknown): Record<string, string> {
  try { fn(); } catch (e) { if (e instanceof ValidationError) return e.details; throw e; }
  assert.fail('deveria ter lançado ValidationError');
}

describe('parseCreateReservation', () => {
  it('aceita o corpo mínimo e normaliza campos opcionais para null', () => {
    assert.deepEqual(parseCreateReservation({ eventId: 1, seatNumber: 'A001' }), { eventId: 1, seatNumber: 'A001', userEmail: null, userId: null });
  });
  it('aceita eventId numérico em string (Jackson também coage)', () => {
    assert.equal(parseCreateReservation({ eventId: '7', seatNumber: 'A1' }).eventId, 7);
  });
  it('usa as mesmas mensagens do Bean Validation', () => {
    assert.deepEqual(details(() => parseCreateReservation({})), { eventId: 'Event ID is required', seatNumber: 'Seat number is required' });
  });
  it('valida o formato do e-mail', () => {
    assert.deepEqual(details(() => parseCreateReservation({ eventId: 1, seatNumber: 'A', userEmail: 'nao-e-email' })), { userEmail: 'Invalid email format' });
  });
  it('rejeita eventId inválido e assento em branco', () => {
    const d = details(() => parseCreateReservation({ eventId: -3, seatNumber: '   ' }));
    assert.match(d.eventId!, /positive integer/);
    assert.equal(d.seatNumber, 'Seat number is required');
  });
  it('rejeita corpo que não é objeto', () => {
    assert.ok(details(() => parseCreateReservation([1])).body);
    assert.ok(details(() => parseCreateReservation(null)).body);
  });
});

describe('parsePaymentRequest', () => {
  it('aceita e descarta os campos de cartão', () => {
    const req = parsePaymentRequest({ reservationToken: 't', paymentMethod: 'CREDIT_CARD', idempotencyKey: 'k', cardNumber: '4111111111111111', cardCvv: '123' });
    assert.deepEqual(req, { reservationToken: 't', paymentMethod: 'CREDIT_CARD', idempotencyKey: 'k' });
  });
  it('mensagens de campo obrigatório', () => {
    assert.deepEqual(details(() => parsePaymentRequest({})), {
      reservationToken: 'Reservation token is required',
      idempotencyKey: 'Idempotency key is required',
      paymentMethod: 'Payment method is required',
    });
  });
  it('rejeita método de pagamento desconhecido', () => {
    assert.match(details(() => parsePaymentRequest({ reservationToken: 't', idempotencyKey: 'k', paymentMethod: 'CHEQUE' })).paymentMethod!, /must be one of/);
  });
  it('limita o tamanho da chave de idempotência à coluna do banco (255)', () => {
    assert.ok(details(() => parsePaymentRequest({ reservationToken: 't', idempotencyKey: 'x'.repeat(256), paymentMethod: 'PIX' })).idempotencyKey);
  });
});

describe('parseId', () => {
  it('só aceita inteiros positivos seguros', () => {
    assert.equal(parseId('12'), 12);
    for (const bad of ['0', '-1', 'abc', '1.5', '', '99999999999999999999']) assert.equal(parseId(bad), null, bad);
  });
});
