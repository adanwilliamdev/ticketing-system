import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateReservationToken } from '../src/lib/token';

describe('generateReservationToken', () => {
  it('não deve ser nulo ou vazio', () => {
    assert.ok(generateReservationToken().trim().length > 0);
  });
  it('deve ter tamanho consistente (32 bytes em Base64 URL-safe sem padding = 43 caracteres)', () => {
    assert.equal(generateReservationToken().length, 43);
  });
  it('não deve conter caracteres inválidos para URL', () => {
    assert.match(generateReservationToken(), /^[A-Za-z0-9_-]+$/);
  });
  it('deve gerar tokens únicos', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) tokens.add(generateReservationToken());
    assert.equal(tokens.size, 1000);
  });
});
