import Link from 'next/link';
import { eventDateParts, formatBRL } from '@/lib/client/format';
import type { EventResponse } from '@/lib/dto';

export function EventList({ events }: { events: EventResponse[] }) {
  return (
    <ul className="events">
      {events.map((event) => {
        const { day, month } = eventDateParts(event.startDateTime);
        const left = Math.round((event.availableTickets / event.totalCapacity) * 100);
        return (
          <li key={event.id}>
            <Link href={`/events/${event.id}`} className="event">
              <span className="event__date">
                <strong>{day}</strong>
                <span>{month}</span>
              </span>
              <span className="event__main">
                <span className="event__name">{event.name}</span>
                <span className="event__place">{event.location ?? 'Local a confirmar'}</span>
                <span className="meter" aria-hidden="true">
                  <span style={{ width: `${left}%` }} />
                </span>
              </span>
              <span className="event__side">
                <strong>{formatBRL(event.price)}</strong>
                <span>{event.availableTickets.toLocaleString('pt-BR')} ingressos</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
