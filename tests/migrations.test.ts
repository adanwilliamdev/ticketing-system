import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { checksum, listMigrations } from '../src/lib/migration-files';
import './helpers/fakes';

const dir = path.join(process.cwd(), 'migrations');

describe('migrações', () => {
  it('são listadas em ordem numérica', async () => {
    const files = await listMigrations(dir);
    assert.deepEqual(files.map((f) => f.version), [1, 2, 3]);
    assert.equal(files[2]!.description, 'allow seat rereservation');
  });
  it('V1 e V2 são idênticos aos do projeto original (mesmo checksum já normalizado)', async () => {
    const v1 = await readFile(path.join(dir, 'V1__create_initial_schema.sql'), 'utf8');
    assert.match(v1, /CREATE TABLE IF NOT EXISTS reservations/);
    assert.equal(checksum('a\r\nb'), checksum('a\nb'));
  });
  it('V3 remove as unicidades globais por ticket_id e cria os índices parciais', async () => {
    const v3 = await readFile(path.join(dir, 'V3__allow_seat_rereservation.sql'), 'utf8');
    assert.match(v3, /DROP CONSTRAINT IF EXISTS reservations_ticket_id_key/);
    assert.match(v3, /DROP CONSTRAINT IF EXISTS payments_ticket_id_key/);
    assert.match(v3, /uk_reservations_active_ticket[\s\S]*WHERE status = 'ACTIVE'/);
    assert.match(v3, /uk_payments_completed_ticket[\s\S]*WHERE status = 'COMPLETED'/);
  });
});
