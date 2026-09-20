import type { Database } from '../db-types';
import { ResourceNotFoundError } from '../errors';
import type { Repositories } from '../repositories';
import type { Event, Ticket } from '../types';

// Não existia no projeto original (só havia API de reservas e pagamentos); é o mínimo que o
// front-end precisa para listar eventos e desenhar o mapa de assentos.
export interface CatalogService {
  listAvailableEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event>;
  listSeats(eventId: number): Promise<Ticket[]>;
}

export function createCatalogService(deps: { db: Database; repos: Repositories }): CatalogService {
  const { db, repos } = deps;

  async function getEvent(id: number): Promise<Event> {
    const event = await repos.events.findById(db.pool, id);
    if (!event) throw new ResourceNotFoundError('Event not found');
    return event;
  }

  return {
    listAvailableEvents: () => repos.events.findAvailable(db.pool),
    getEvent,
    async listSeats(eventId) {
      await getEvent(eventId);
      return repos.tickets.listByEvent(db.pool, eventId);
    },
  };
}
