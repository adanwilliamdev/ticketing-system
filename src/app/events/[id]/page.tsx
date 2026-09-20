'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorNotice, Loading } from '@/components/StateMessage';
import { SeatMap } from '@/components/SeatMap';
import { ApiError, api } from '@/lib/client/api';
import { formatBRL, formatEventDate } from '@/lib/client/format';
import { useResource } from '@/lib/client/hooks';

export default function EventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(params.id);

  const event = useResource(() => api.getEvent(eventId), [eventId]);
  // O mapa é atualizado a cada 10 s para refletir assentos que outras pessoas reservam.
  const seats = useResource(() => api.listSeats(eventId), [eventId], 10_000);

  const [selected, setSelected] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reserve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const reservation = await api.createReservation({
        eventId,
        seatNumber: selected,
        ...(email.trim() ? { userEmail: email.trim() } : {}),
      });
      router.push(`/reservations/${encodeURIComponent(reservation.reservationToken)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reservar.');
      if (err instanceof ApiError && err.status === 400) {
        setSelected(null); // o assento provavelmente foi levado por outra pessoa
        void seats.reload();
      }
      setSubmitting(false);
    }
  }

  if (event.error && !event.data) {
    const notFound = event.error instanceof ApiError && event.error.status === 404;
    return notFound ? (
      <EmptyState title="Evento não encontrado">
        <Link href="/">Ver todos os eventos</Link>
      </EmptyState>
    ) : (
      <ErrorNotice message={event.error.message} onRetry={() => void event.reload()} />
    );
  }
  if (!event.data) return <Loading />;

  const ev = event.data;
  const seatInfo = selected ? seats.data?.find((s) => s.seatNumber === selected) : undefined;

  return (
    <>
      <p className="crumb">
        <Link href="/">Eventos</Link>
      </p>
      <h1>{ev.name}</h1>
      <p className="lead">
        {formatEventDate(ev.startDateTime)} · {ev.location ?? 'Local a confirmar'}
      </p>
      {ev.description ? <p className="prose">{ev.description}</p> : null}

      {seats.loading && !seats.data ? <Loading label="Carregando o mapa de assentos…" /> : null}
      {seats.error && !seats.data ? <ErrorNotice message={seats.error.message} onRetry={() => void seats.reload()} /> : null}
      {seats.data ? <SeatMap seats={seats.data} selected={selected} onSelect={setSelected} /> : null}

      <form className={selected ? 'checkout checkout--open' : 'checkout'} onSubmit={reserve} aria-hidden={selected ? undefined : true}>
        {selected ? (
          <>
            <div className="checkout__seat">
              <strong>Assento {selected}</strong>
              <span>
                {seatInfo?.section ?? ''} · {formatBRL(ev.price)}
              </span>
            </div>
            <label className="field">
              <span>E-mail (opcional)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoComplete="email" />
            </label>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Reservando…' : 'Reservar por 10 minutos'}
            </button>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </form>
    </>
  );
}
