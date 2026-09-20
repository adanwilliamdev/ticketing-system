import type { ReactNode } from 'react';
import { formatBRL } from '@/lib/client/format';
import type { ReservationResponse } from '@/lib/dto';

interface ReservationStubProps {
  reservation: ReservationResponse;
  price: number | null;
  /** Reserva ACTIVE e ainda dentro do prazo. */
  active: boolean;
  /** Contagem regressiva, exibida no lado direito enquanto a reserva está ativa. */
  countdown?: ReactNode;
}

/** A reserva como um canhoto de ingresso: dados à esquerda, picote, prazo/estado à direita. */
export function ReservationStub({ reservation, price, active, countdown }: ReservationStubProps) {
  const variant = active ? 'active' : reservation.status.toLowerCase();
  return (
    <article className={`stub stub--${variant}`}>
      <div className="stub__main">
        <h1>{reservation.eventName}</h1>
        <dl className="stub__facts">
          <div>
            <dt>Assento</dt>
            <dd>{reservation.seatNumber}</dd>
          </div>
          {price !== null ? (
            <div>
              <dt>Valor</dt>
              <dd>{formatBRL(price)}</dd>
            </div>
          ) : null}
          {reservation.userEmail ? (
            <div>
              <dt>E-mail</dt>
              <dd>{reservation.userEmail}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="stub__tear" aria-hidden="true" />
      <div className="stub__side">
        {active ? countdown : null}
        {reservation.status === 'COMPLETED' ? <p className="stamp stamp--ok">Ingresso confirmado</p> : null}
        {!active && reservation.status === 'ACTIVE' ? <p className="stamp">Prazo encerrado</p> : null}
        {reservation.status === 'CANCELLED' || reservation.status === 'EXPIRED' ? <p className="stamp">Reserva liberada</p> : null}
      </div>
    </article>
  );
}
