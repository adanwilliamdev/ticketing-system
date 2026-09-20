'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Countdown } from '@/components/Countdown';
import { PaymentPanel } from '@/components/PaymentPanel';
import { ReservationStub } from '@/components/ReservationStub';
import { EmptyState, ErrorNotice, Loading } from '@/components/StateMessage';
import { ApiError, api } from '@/lib/client/api';
import { useResource } from '@/lib/client/hooks';

export default function ReservationPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token);

  const reservation = useResource(() => api.getReservation(token), [token]);
  const event = useResource(
    async () => (reservation.data ? api.getEvent(reservation.data.eventId) : null),
    [reservation.data?.eventId],
  );
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // O prazo vem da API como "segundos restantes" e é convertido para um instante do relógio local;
  // assim um relógio de navegador desregulado não distorce a contagem.
  const data = reservation.data;
  const deadline = useMemo(() => (data ? Date.now() + data.timeRemainingSeconds * 1000 : 0), [data]);

  if (reservation.error && !data) {
    const notFound = reservation.error instanceof ApiError && reservation.error.status === 404;
    return notFound ? (
      <EmptyState title="Reserva não encontrada">
        <p>O link pode estar incorreto ou a reserva já foi removida.</p>
        <Link href="/">Ver eventos</Link>
      </EmptyState>
    ) : (
      <ErrorNotice message={reservation.error.message} onRetry={() => void reservation.reload()} />
    );
  }
  if (!data) return <Loading />;

  const price = event.data?.price ?? null;
  const active = data.status === 'ACTIVE' && data.timeRemainingSeconds > 0;

  async function cancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelReservation(token);
      await reservation.reload();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <p className="crumb">
        <Link href={`/events/${data.eventId}`}>{data.eventName}</Link>
      </p>

      <ReservationStub
        reservation={data}
        price={price}
        active={active}
        countdown={<Countdown deadline={deadline} onExpire={() => void reservation.reload()} />}
      />

      {active ? (
        <section className="after">
          <PaymentPanel reservationToken={token} price={price} onSettled={() => void reservation.reload()} />
          <button type="button" className="btn btn--quiet" onClick={() => void cancel()} disabled={cancelling}>
            {cancelling ? 'Cancelando…' : 'Cancelar reserva'}
          </button>
          {cancelError ? (
            <p className="form-error" role="alert">
              {cancelError}
            </p>
          ) : null}
        </section>
      ) : null}

      {data.status === 'COMPLETED' ? (
        <p className="prose">Pagamento aprovado. Guarde o link desta página: ele é o seu comprovante.</p>
      ) : null}
      {!active && data.status !== 'COMPLETED' ? (
        <p className="prose">
          O assento voltou a ficar disponível. <Link href={`/events/${data.eventId}`}>Escolher outro assento</Link>
        </p>
      ) : null}
    </>
  );
}
