'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ErrorState } from '@/components/state-message';
import { ApiError, api, generateIdempotencyKey } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { PAYMENT_METHODS, type PaymentMethod, type Reservation } from '@/lib/types';

export function PaymentPanel({ reservation }: { reservation: Reservation }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  // Uma chave por "sessão de pagamento": se a mutation falhar e o usuário tentar de novo,
  // reutilizamos a MESMA chave — reenviar com uma chave nova reintroduziria cobrança duplicada
  // caso a primeira tentativa tenha sido processada mas a resposta se perdido.
  const [idempotencyKey] = useState(generateIdempotencyKey);

  const pay = useMutation({
    mutationFn: () => api.pay({ reservationToken: reservation.reservationToken, paymentMethod: method, idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservation(reservation.reservationToken) });
    },
  });

  if (pay.isSuccess) {
    return (
      <Card className="border-success/50">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <div>
            <p className="text-lg font-medium">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground">
              Assento {reservation.seatNumber} para {reservation.eventName} garantido.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
          {PAYMENT_METHODS.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {pay.isError && (
          <ErrorState
            title="Pagamento não concluído"
            message={pay.error instanceof ApiError ? pay.error.message : 'Tente novamente.'}
          />
        )}

        <Button onClick={() => pay.mutate()} disabled={pay.isPending} className="w-full">
          {pay.isPending ? 'Processando pagamento...' : 'Confirmar pagamento'}
        </Button>
      </CardContent>
    </Card>
  );
}
