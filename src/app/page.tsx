'use client';

import { EventList } from '@/components/EventList';
import { EmptyState, ErrorNotice, Loading } from '@/components/StateMessage';
import { api } from '@/lib/client/api';
import { useResource } from '@/lib/client/hooks';

export default function HomePage() {
  const { data: events, error, loading, reload } = useResource(() => api.listEvents(), [], 15_000);

  return (
    <>
      <h1>Próximos eventos</h1>
      <p className="lead">Escolha um evento, marque seu assento e pague em poucos minutos.</p>

      {loading && !events ? <Loading /> : null}
      {error && !events ? <ErrorNotice message={error.message} onRetry={() => void reload()} /> : null}
      {events && events.length === 0 ? (
        <EmptyState title="Nenhum evento com ingressos no momento">
          <p>Volte mais tarde: novos eventos aparecem aqui assim que forem publicados.</p>
        </EmptyState>
      ) : null}

      {events && events.length > 0 ? <EventList events={events} /> : null}
    </>
  );
}
