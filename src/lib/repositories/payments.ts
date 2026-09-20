import { DuplicatePaymentError } from '../errors';
import { isUniqueViolation } from '../pg-errors';
import type { Payment, PaymentMethod, PaymentStatus } from '../types';
import type { PaymentRepository } from './interfaces';

type PaymentRow = {
  id: number;
  payment_id: string | null;
  idempotency_key: string;
  reservation_id: number;
  ticket_id: number;
  amount: string;
  currency: string | null;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  transaction_id: string | null;
  failure_reason: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS =
  'id, payment_id, idempotency_key, reservation_id, ticket_id, amount, currency, status, payment_method, transaction_id, failure_reason, completed_at, created_at, updated_at';

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    paymentId: row.payment_id,
    idempotencyKey: row.idempotency_key,
    reservationId: row.reservation_id,
    ticketId: row.ticket_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    failureReason: row.failure_reason,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const paymentRepository: PaymentRepository = {
  async findByIdempotencyKey(q, key) {
    const res = await q.query<PaymentRow>(`SELECT ${COLUMNS} FROM payments WHERE idempotency_key = $1`, [key]);
    const row = res.rows[0];
    return row ? toPayment(row) : null;
  },

  async findByReservationId(q, reservationId) {
    const res = await q.query<PaymentRow>(`SELECT ${COLUMNS} FROM payments WHERE reservation_id = $1`, [reservationId]);
    const row = res.rows[0];
    return row ? toPayment(row) : null;
  },

  async insert(q, payment) {
    try {
      const res = await q.query<PaymentRow>(
        `INSERT INTO payments (payment_id, idempotency_key, reservation_id, ticket_id, amount, currency, status,
                               payment_method, transaction_id, failure_reason, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING ${COLUMNS}`,
        [
          payment.paymentId,
          payment.idempotencyKey,
          payment.reservationId,
          payment.ticketId,
          payment.amount,
          payment.currency,
          payment.status,
          payment.paymentMethod,
          payment.transactionId,
          payment.failureReason,
          payment.completedAt ? payment.completedAt.toISOString() : null,
        ],
      );
      const row = res.rows[0];
      if (!row) throw new Error('INSERT de pagamento não retornou a linha criada');
      return toPayment(row);
    } catch (error) {
      // Última barreira de idempotência: duas requisições com a mesma chave que passem pelo lock.
      if (isUniqueViolation(error, 'payments_idempotency_key_key')) {
        throw new DuplicatePaymentError('Payment already processed');
      }
      throw error;
    }
  },
};
