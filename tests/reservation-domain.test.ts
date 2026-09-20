import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toReservationResponse } from '../src/lib/dto';
import { isReservationExpired, type Reservation } from '../src/lib/types';

describe('isReservationExpired', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  it('retorna true quando a data de expiração já passou', () => {
    assert.equal(isReservationExpired({ expiresAt: new Date(now.getTime() - 60_000) }, now), true);
  });
  it('retorna false quando a data de expiração está no futuro', () => {
    assert.equal(isReservationExpired({ expiresAt: new Date(now.getTime() + 60_000) }, now), false);
  });
  it('não considera expirada exatamente no instante de expiração (isAfter estrito)', () => {
    assert.equal(isReservationExpired({ expiresAt: now }, now), false);
  });
});

describe('toReservationResponse', () => {
  it('limita timeRemainingSeconds a 0 e serializa a data em ISO UTC', () => {
    const now = new Date('2026-09-19T12:00:00Z');
    const r = { reservationToken: 't', eventId: 1, eventName: 'E', seatNumber: 'A1', userEmail: null, status: 'ACTIVE', expiresAt: new Date('2026-09-19T11:59:00Z') } as Reservation;
    const res = toReservationResponse(r, now);
    assert.equal(res.timeRemainingSeconds, 0);
    assert.equal(res.expiresAt, '2026-09-19T11:59:00.000Z');
  });
});
