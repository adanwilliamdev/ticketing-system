'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Countdown } from '@/components/countdown';
import { ErrorState, LoadingState } from '@/components/state-message';
import { PaymentPanel } from '@/components/payment-panel';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { ReservationStatus } from '@/lib/types';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  ACTIVE: 'Ativa',
  COMPLETED: 'Paga',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
};

export default function ReservationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState(false);

  const {
    data: reservation,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.reservation(token),
    queryFn: () => api.getReservation(token),
    refetchInterval: (query) => (query.state.data?.status === 'ACTIVE' ? 10_000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelReservation(token),
    onSuccess: () => {
      setCancelled(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.reservation(token) });
    },
  });

  if (isPending) return <LoadingState label="Carregando reserva..." />;
  if (isError) {
    return <ErrorState title="Reserva não encontrada" message={error instanceof Error ? error.message : 'Tente novamente.'} />;
  }

  const isExpired = reservation.status === 'EXPIRED' || (reservation.status === 'ACTIVE' && new Date(reservation.expiresAt) <= new Date());

  return (
    <main className="mx-auto max-w-md space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Todos os eventos
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{reservation.eventName}</CardTitle>
            <Badge variant={reservation.status === 'COMPLETED' ? 'success' : reservation.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {STATUS_LABEL[reservation.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Assento</span>
            <span className="font-medium">{reservation.seatNumber}</span>
          </div>
          {reservation.userEmail && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{reservation.userEmail}</span>
            </div>
          )}

          {reservation.status === 'ACTIVE' && !cancelled && (
            <div className="flex items-center justify-between border-t pt-3">
              <Countdown
                expiresAt={reservation.expiresAt}
                onExpire={() => queryClient.invalidateQueries({ queryKey: queryKeys.reservation(token) })}
              />
              <Button variant="ghost" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {cancel.isPending ? 'Cancelando...' : 'Cancelar reserva'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {cancel.isError && <ErrorState title="Não foi possível cancelar" message="Tente novamente em instantes." />}

      {cancelled && <ErrorState title="Reserva cancelada" message="O assento foi liberado para outras pessoas." />}

      {reservation.status === 'ACTIVE' && !isExpired && !cancelled && <PaymentPanel reservation={reservation} />}

      {isExpired && reservation.status === 'ACTIVE' && (
        <ErrorState title="Reserva expirada" message="O tempo para concluir o pagamento acabou. Escolha o assento novamente." />
      )}
    </main>
  );
}
