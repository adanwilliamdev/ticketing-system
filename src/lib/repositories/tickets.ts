import type { Ticket, TicketStatus } from '../types';
import type { TicketRepository } from './interfaces';

type TicketRow = {
  id: number;
  event_id: number;
  seat_number: string;
  section: string | null;
  row_number: string | null;
  status: TicketStatus;
  version: number | null;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = 'id, event_id, seat_number, section, row_number, status, version, created_at, updated_at';

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    eventId: row.event_id,
    seatNumber: row.seat_number,
    section: row.section,
    rowNumber: row.row_number,
    status: row.status,
    version: row.version ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ticketRepository: TicketRepository = {
  async findByIdForUpdate(q, id) {
    const res = await q.query<TicketRow>(`SELECT ${COLUMNS} FROM tickets WHERE id = $1 FOR UPDATE`, [id]);
    const row = res.rows[0];
    return row ? toTicket(row) : null;
  },

  async findByEventAndSeatForUpdate(q, eventId, seatNumber) {
    const res = await q.query<TicketRow>(
      `SELECT ${COLUMNS} FROM tickets WHERE event_id = $1 AND seat_number = $2 FOR UPDATE`,
      [eventId, seatNumber],
    );
    const row = res.rows[0];
    return row ? toTicket(row) : null;
  },

  async listByEvent(q, eventId) {
    const res = await q.query<TicketRow>(`SELECT ${COLUMNS} FROM tickets WHERE event_id = $1 ORDER BY id`, [eventId]);
    return res.rows.map(toTicket);
  },

  async updateStatus(q, id, status) {
    await q.query('UPDATE tickets SET status = $2, version = COALESCE(version, 0) + 1 WHERE id = $1', [id, status]);
  },
};
