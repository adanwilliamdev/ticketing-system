import { EventList } from '@/components/event-list';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Eventos disponíveis</h1>
        <p className="text-muted-foreground">Escolha um evento para ver os assentos e reservar o seu.</p>
      </div>
      <EventList />
    </main>
  );
}
