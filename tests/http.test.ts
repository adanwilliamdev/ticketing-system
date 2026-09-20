import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessError, DuplicatePaymentError, ResourceNotFoundError, ValidationError } from '../src/lib/errors';
import { mapError, readJson } from '../src/lib/http';
import './helpers/fakes';

describe('mapError (GlobalExceptionHandler)', () => {
  it('ResourceNotFound → 404', () => {
    const { status, body } = mapError(new ResourceNotFoundError('Seat not found'));
    assert.equal(status, 404);
    assert.equal(body.error, 'Not Found');
    assert.equal(body.message, 'Seat not found');
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  });
  it('BusinessError → 400', () => {
    const { status, body } = mapError(new BusinessError('Seat is not available'));
    assert.equal(status, 400);
    assert.equal(body.error, 'Bad Request');
  });
  it('DuplicatePayment → 409', () => {
    assert.equal(mapError(new DuplicatePaymentError('Payment already processed')).status, 409);
  });
  it('ValidationError → 400 com details', () => {
    const { status, body } = mapError(new ValidationError({ eventId: 'Event ID is required' }));
    assert.equal(status, 400);
    assert.equal(body.message, 'Validation failed');
    assert.deepEqual(body.details, { eventId: 'Event ID is required' });
  });
  it('erro desconhecido → 500 sem vazar detalhes internos', () => {
    const { status, body } = mapError(new Error('senha do banco: hunter2'));
    assert.equal(status, 500);
    assert.equal(body.message, 'An unexpected error occurred');
    assert.equal(JSON.stringify(body).includes('hunter2'), false);
  });
});

describe('readJson', () => {
  const req = (body: string) => new Request('http://x/api', { method: 'POST', body });
  it('lê JSON válido', async () => { assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 }); });
  it('JSON malformado → BusinessError (400)', async () => { await assert.rejects(readJson(req('{oops')), BusinessError); });
  it('corpo vazio → ValidationError', async () => { await assert.rejects(readJson(req('  ')), ValidationError); });
});
