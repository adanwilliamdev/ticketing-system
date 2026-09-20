import { eventRepository } from './events';
import type { Repositories } from './interfaces';
import { paymentRepository } from './payments';
import { reservationRepository } from './reservations';
import { ticketRepository } from './tickets';

export function createPostgresRepositories(): Repositories {
  return {
    events: eventRepository,
    tickets: ticketRepository,
    reservations: reservationRepository,
    payments: paymentRepository,
  };
}

export type { Repositories } from './interfaces';
