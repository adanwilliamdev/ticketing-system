import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ResourceNotFoundError } from '../src/lib/errors';
import { createCatalogService } from '../src/lib/services/catalog-service';
import { createFakeDatabase, MemoryStore } from './helpers/fakes';

describe('CatalogService', () => {
  const store = new MemoryStore();
  const catalog = createCatalogService({ db: createFakeDatabase(store), repos: store.repositories() });
  const pub = store.addEvent({ name: 'Publicado' });
  store.addEvent({ name: 'Rascunho', status: 'DRAFT' });
  store.addEvent({ name: 'Esgotado', availableTickets: 0 });
  store.addTicket(pub.id, 'A1');

  it('lista só eventos publicados com ingressos', async () => {
    assert.deepEqual((await catalog.listAvailableEvents()).map((e) => e.name), ['Publicado']);
  });
  it('devolve os assentos de um evento', async () => {
    assert.equal((await catalog.listSeats(pub.id)).length, 1);
  });
  it('404 para evento inexistente', async () => {
    await assert.rejects(catalog.getEvent(999), ResourceNotFoundError);
    await assert.rejects(catalog.listSeats(999), ResourceNotFoundError);
  });
});
