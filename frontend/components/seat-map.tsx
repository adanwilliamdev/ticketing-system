'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/state-message';
import { ApiError, api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Seat, TicketStatus } from '@/lib/types';

const SEAT_CLASS: Record<TicketStatus, string> = {
  AVAILABLE: 'seat-available',
  RESERVED: 'seat-reserved',
  SOLD: 'seat-sold',
  CANCELLED: 'seat-cancelled',
};

function groupBySection(seats: Seat[]): Map<string, Seat[]> {
  const groups = new Map<string, Seat[]>();
  for (const seat of seats) {
    const key = seat.section ?? 'Geral';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(seat);
  }
  return groups;
}

export function SeatMap({ eventId }: { eventId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const {
    data: seats,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.seats(eventId),
    queryFn: () => api.listSeats(eventId),
    refetchInterval: 15_000,
  });

  const sections = useMemo(() => (seats ? groupBySection(seats) : new Map<string, Seat[]>()), [seats]);

  const reserve = useMutation({
    mutationFn: () => api.createReservation({ eventId, seatNumber: selectedSeat!, userEmail: email || undefined }),
    onSuccess: (reservation) => {
      router.push(`/reservations/${reservation.reservationToken}`);
    },
    onError: () => {
      // Assento provavelmente foi levado por outra pessoa — atualiza o mapa para refletir o estado real.
      queryClient.invalidateQueries({ queryKey: queryKeys.seats(eventId) });
    },
  });

  if (isPending) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (isError) {
    return <ErrorState message={error instanceof Error ? error.message : 'Não foi possível carregar o mapa de assentos.'} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <LegendItem className="seat-available" label="Disponível" />
            <LegendItem className="seat-selected" label="Selecionado" />
            <LegendItem className="seat-reserved" label="Reservado" />
            <LegendItem className="seat-sold" label="Vendido" />
          </div>

          {Array.from(sections.entries()).map(([section, sectionSeats]) => (
            <div key={section} className="space-y-2">
              <h3 className="text-sm font-medium">{section}</h3>
              <div className="flex flex-wrap gap-2">
                {sectionSeats.map((seat) => {
                  const isSelected = selectedSeat === seat.seatNumber;
                  const isAvailable = seat.status === 'AVAILABLE';
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedSeat(isSelected ? null : seat.seatNumber)}
                      title={`${seat.seatNumber}${seat.rowNumber ? ` · ${seat.rowNumber}` : ''}`}
                      className={`flex h-9 w-14 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                        isSelected ? 'seat-selected' : SEAT_CLASS[seat.status]
                      }`}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedSeat && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reservar assento {selectedSeat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {reserve.isError && (
              <ErrorState
                title="Não foi possível reservar"
                message={reserve.error instanceof ApiError ? reserve.error.message : 'Tente novamente.'}
              />
            )}

            <div className="flex gap-2">
              <Button onClick={() => reserve.mutate()} disabled={reserve.isPending}>
                {reserve.isPending ? 'Reservando...' : 'Reservar este assento'}
              </Button>
              <Button variant="outline" onClick={() => setSelectedSeat(null)} disabled={reserve.isPending}>
                Cancelar seleção
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Você terá alguns minutos para concluir o pagamento antes que a reserva expire.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded border ${className}`} />
      {label}
    </div>
  );
}
