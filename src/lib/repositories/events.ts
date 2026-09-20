import type { Event, EventStatus } from '../types';
import type { EventRepository } from './interfaces';

type EventRow = {
  id: number;
  name: string;
  description: string | null;
  start_date_time: Date;
  end_date_time: Date;
  location: string | null;
  total_capacity: number;
  available_tickets: number;
  price: string;
  status: EventStatus;
  version: number | null;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS =
  'id, name, description, start_date_time, end_date_time, location, total_capacity, available_tickets, price, status, version, created_at, updated_at';

function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDateTime: row.start_date_time,
    endDateTime: row.end_date_time,
    location: row.location,
    totalCapacity: row.total_capacity,
    availableTickets: row.available_tickets,
    price: row.price,
    status: row.status,
    version: row.version ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const eventRepository: EventRepository = {
  async findById(q, id) {
    const res = await q.query<EventRow>(`SELECT ${COLUMNS} FROM events WHERE id = $1`, [id]);
    const row = res.rows[0];
    return row ? toEvent(row) : null;
  },

  async findByIdForUpdate(q, id) {
    const res = await q.query<EventRow>(`SELECT ${COLUMNS} FROM events WHERE id = $1 FOR UPDATE`, [id]);
    const row = res.rows[0];
    return row ? toEvent(row) : null;
  },

  async findAvailable(q) {
    const res = await q.query<EventRow>(
      `SELECT ${COLUMNS} FROM events WHERE available_tickets > 0 AND status = 'PUBLISHED' ORDER BY start_date_time, id`,
    );
    return res.rows.map(toEvent);
  },

  async decrementAvailable(q, id) {
    await q.query('UPDATE events SET available_tickets = available_tickets - 1, version = COALESCE(version, 0) + 1 WHERE id = $1', [id]);
  },

  async incrementAvailable(q, id) {
    await q.query('UPDATE events SET available_tickets = available_tickets + 1, version = COALESCE(version, 0) + 1 WHERE id = $1', [id]);
  },
};
