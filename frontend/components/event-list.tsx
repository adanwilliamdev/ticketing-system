'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/state-message';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

export function EventList() {
  const { data: events, isPending, isError, error } = useQuery({
    queryKey: queryKeys.events,
    queryFn: api.listEvents,
  });

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={error instanceof Error ? error.message : 'Não foi possível carregar os eventos.'} />;
  }

  if (events.length === 0) {
    return <p className="py-16 text-center text-muted-foreground">Nenhum evento disponível no momento.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {events.map((event) => (
        <Link key={event.id} href={`/events/${event.id}`}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{event.name}</CardTitle>
                <Badge variant="secondary" className="shrink-0">
                  {formatCurrency(event.price)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>{formatDateTime(event.startDateTime)}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 shrink-0" />
                <span>{event.availableTickets} ingressos disponíveis</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
