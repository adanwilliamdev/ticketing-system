import type { Database } from '../db-types';
import { BusinessError, DuplicatePaymentError, ResourceNotFoundError } from '../errors';
import type { LockManager } from '../lock';
import { log } from '../logger';
import type { PaymentGateway } from '../payment-gateway';
import type { Repositories } from '../repositories';
import { isReservationExpired, type Payment, type Reservation } from '../types';
import type { PaymentRequest } from '../validation';
import { releaseActiveReservation, type ReservationService } from './reservation-service';

export interface PaymentService {
  processPayment(request: PaymentRequest): Promise<Payment>;
  getPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment>;
  getPaymentByReservationToken(token: string): Promise<Payment>;
  refundPayment(paymentId: string): Promise<void>;
}

export interface PaymentServiceDeps {
  db: Database;
  repos: Repositories;
  reservations: ReservationService;
  locks: LockManager;
  gateway: PaymentGateway;
  now: () => Date;
  generateId: () => string;
}

const PAYMENT_LOCK = { waitMs: 10_000, leaseMs: 15_000 };
const RESERVATION_LOCK = { waitMs: 5_000, leaseMs: 10_000 };
const CURRENCY = 'BRL';

export function createPaymentService(deps: PaymentServiceDeps): PaymentService {
  const { db, repos, reservations, locks, gateway } = deps;

  async function processPayment(request: PaymentRequest): Promise<Payment> {
    const outer = await locks.tryWithLock(`payment:${request.idempotencyKey}`, PAYMENT_LOCK, async () => {
      // 1. Idempotência: a chave já foi usada?
      const existing = await repos.payments.findByIdempotencyKey(db.pool, request.idempotencyKey);
      if (existing) {
        log.warn(`Duplicate payment attempt detected: ${request.idempotencyKey}`);
        throw new DuplicatePaymentError('Payment already processed');
      }

      // 2. A reserva existe, está ativa e não expirou?
      if (!(await reservations.isReservationValid(request.reservationToken))) {
        throw new BusinessError('Invalid or expired reservation');
      }
      const reservation = await reservations.getReservationByToken(request.reservationToken);

      // 3. Exclusão mútua sobre a reserva (job de expiração, cancelamento e outros pagamentos).
      const inner = await locks.tryWithLock(`reservation:${request.reservationToken}`, RESERVATION_LOCK, () =>
        chargeAndSettle(reservation, request),
      );
      if (!inner.acquired) throw new BusinessError('Could not acquire lock for reservation');
      return inner.value;
    });

    if (!outer.acquired) throw new BusinessError('Could not acquire lock for payment processing');
    return outer.value;
  }

  async function chargeAndSettle(stale: Reservation, request: PaymentRequest): Promise<Payment> {
    // Releitura já com o lock da reserva: entre a validação e a aquisição do lock, outro pagamento
    // pode ter concluído (ou o job de expiração ter cancelado). Sem isso, cobraríamos duas vezes.
    const reservation = await reservations.getReservationByToken(stale.reservationToken);
    if (reservation.status !== 'ACTIVE' || isReservationExpired(reservation, deps.now())) {
      throw new BusinessError('Invalid or expired reservation');
    }

    const paymentId = deps.generateId();
    const amount = reservation.eventPrice;

    // A chamada ao gateway fica FORA de qualquer transação: não segura conexão nem locks de linha
    // enquanto espera um serviço externo.
    try {
      await gateway.charge({
        paymentId,
        amount,
        currency: CURRENCY,
        method: request.paymentMethod,
        reservationToken: reservation.reservationToken,
      });
    } catch (error) {
      log.error('Payment processing failed', error);
      const message = error instanceof Error ? error.message : String(error);

      // Registra o pagamento como FAILED e devolve o assento — na MESMA transação, e commitada antes
      // de o erro subir. (No original o erro fazia o @Transactional dar rollback nesses dois passos.)
      await db.transaction(async (tx) => {
        await releaseActiveReservation(repos, tx, reservation);
        await repos.payments.insert(tx, {
          paymentId,
          idempotencyKey: request.idempotencyKey,
          reservationId: reservation.id,
          ticketId: reservation.ticketId,
          amount,
          currency: CURRENCY,
          status: 'FAILED',
          paymentMethod: request.paymentMethod,
          transactionId: null,
          failureReason: message,
          completedAt: null,
        });
      });
      throw new BusinessError(`Payment processing failed: ${message}`, { cause: error });
    }

    return db.transaction(async (tx) => {
      // Ordem de locks: assento → reserva (subsequência da ordem evento → assento → reserva).
      await repos.tickets.findByIdForUpdate(tx, reservation.ticketId);
      const current = await repos.reservations.findByIdForUpdate(tx, reservation.id);
      if (!current || current.status !== 'ACTIVE') {
        // Só acontece se o lease do lock expirou durante a cobrança. A cobrança já ocorreu:
        // vale alarme para reconciliação/estorno manual.
        log.error(`Reservation ${reservation.reservationToken} no longer active after charge ${paymentId}; manual refund may be required`);
        throw new BusinessError('Reservation is no longer active');
      }

      const payment = await repos.payments.insert(tx, {
        paymentId,
        idempotencyKey: request.idempotencyKey,
        reservationId: reservation.id,
        ticketId: reservation.ticketId,
        amount,
        currency: CURRENCY,
        status: 'COMPLETED',
        paymentMethod: request.paymentMethod,
        transactionId: null,
        failureReason: null,
        completedAt: deps.now(),
      });
      await repos.tickets.updateStatus(tx, reservation.ticketId, 'SOLD');
      await repos.reservations.updateStatus(tx, reservation.id, 'COMPLETED');

      log.info(`Payment processed successfully: ${payment.id}`);
      return payment;
    });
  }

  async function getPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment> {
    const payment = await repos.payments.findByIdempotencyKey(db.pool, idempotencyKey);
    if (!payment) throw new ResourceNotFoundError('Payment not found');
    return payment;
  }

  async function getPaymentByReservationToken(token: string): Promise<Payment> {
    const reservation = await reservations.getReservationByToken(token);
    const payment = await repos.payments.findByReservationId(db.pool, reservation.id);
    if (!payment) throw new ResourceNotFoundError('Payment not found');
    return payment;
  }

  async function refundPayment(paymentId: string): Promise<void> {
    // TODO: no projeto original este método também era apenas um stub (só registrava em log).
    log.info(`Processing refund for payment: ${paymentId}`);
  }

  return { processPayment, getPaymentByIdempotencyKey, getPaymentByReservationToken, refundPayment };
}
