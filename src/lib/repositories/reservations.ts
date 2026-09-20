import type { Reservation, ReservationStatus } from '../types';
import type { ReservationRepository } from './interfaces';

type ReservationRow = {
  id: number;
  reservation_token: string;
  event_id: number;
  ticket_id: number;
  user_id: string | null;
  user_email: string | null;
  expires_at: Date;
  status: ReservationStatus;
  created_at: Date;
  updated_at: Date;
  event_name: string;
  event_price: string;
  seat_number: string;
};

// Toda leitura de reserva já traz nome/preço do evento e o número do assento (o que a API sempre
// precisa), evitando o carregamento lazy do JPA. O alias `r` é a tabela ou o CTE de INSERT.
const JOINED_COLUMNS = `
  r.id, r.reservation_token, r.event_id, r.ticket_id, r.user_id, r.user_email, r.expires_at, r.status,
  r.created_at, r.updated_at, e.name AS event_name, e.price AS event_price, t.seat_number`;
const JOINS = 'JOIN events e ON e.id = r.event_id JOIN tickets t ON t.id = r.ticket_id';

// Datas vão como ISO-8601 em UTC: colunas TIMESTAMP ignoram o sufixo "Z", e assim o valor gravado
// não depende do fuso horário do processo Node.
const iso = (date: Date): string => date.toISOString();

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    reservationToken: row.reservation_token,
    eventId: row.event_id,
    ticketId: row.ticket_id,
    userId: row.user_id,
    userEmail: row.user_email,
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventName: row.event_name,
    eventPrice: row.event_price,
    seatNumber: row.seat_number,
  };
}

export const reservationRepository: ReservationRepository = {
  async findByToken(q, token) {
    const res = await q.query<ReservationRow>(
      `SELECT ${JOINED_COLUMNS} FROM reservations r ${JOINS} WHERE r.reservation_token = $1`,
      [token],
    );
    const row = res.rows[0];
    return row ? toReservation(row) : null;
  },

  async findByIdForUpdate(q, id) {
    // FOR UPDATE OF r: trava só a linha da reserva (evento e assento são travados à parte, em ordem fixa).
    const res = await q.query<ReservationRow>(
      `SELECT ${JOINED_COLUMNS} FROM reservations r ${JOINS} WHERE r.id = $1 FOR UPDATE OF r`,
      [id],
    );
    const row = res.rows[0];
    return row ? toReservation(row) : null;
  },

  async existsActiveForTicket(q, ticketId) {
    const res = await q.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM reservations WHERE ticket_id = $1 AND status = 'ACTIVE') AS "exists"`,
      [ticketId],
    );
    return res.rows[0]?.exists === true;
  },

  async insert(q, reservation) {
    const res = await q.query<ReservationRow>(
      `WITH r AS (
         INSERT INTO reservations (reservation_token, event_id, ticket_id, user_id, user_email, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         RETURNING *
       )
       SELECT ${JOINED_COLUMNS} FROM r ${JOINS}`,
      [
        reservation.reservationToken,
        reservation.eventId,
        reservation.ticketId,
        reservation.userId,
        reservation.userEmail,
        iso(reservation.expiresAt),
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('INSERT de reserva não retornou a linha criada');
    return toReservation(row);
  },

  async updateStatus(q, id, status) {
    await q.query('UPDATE reservations SET status = $2 WHERE id = $1', [id, status]);
  },

  async updateExpiresAt(q, id, expiresAt) {
    const res = await q.query(`UPDATE reservations SET expires_at = $2 WHERE id = $1 AND status = 'ACTIVE'`, [id, iso(expiresAt)]);
    return res.rowCount === 1;
  },

  async findExpiredActive(q, now) {
    const res = await q.query<ReservationRow>(
      `SELECT ${JOINED_COLUMNS} FROM reservations r ${JOINS}
       WHERE r.status = 'ACTIVE' AND r.expires_at < $1
       ORDER BY r.expires_at`,
      [iso(now)],
    );
    return res.rows.map(toReservation);
  },
};
