'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ApiError, api, newIdempotencyKey } from '@/lib/client/api';
import { formatBRL, PAYMENT_METHOD_LABELS } from '@/lib/client/format';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/types';

interface PaymentPanelProps {
  reservationToken: string;
  price: number | null;
  /** Chamado quando o pagamento foi concluído, ou quando a reserva deixou de existir (expirou/foi liberada). */
  onSettled: () => void;
}

export function PaymentPanel({ reservationToken, price, onSettled }: PaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uma chave por tela de pagamento: cliques repetidos ou reenvios após falha de rede não cobram duas vezes.
  const keyRef = useRef<string | null>(null);
  if (keyRef.current === null) keyRef.current = newIdempotencyKey();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const idempotencyKey = keyRef.current ?? newIdempotencyKey();
    setSubmitting(true);
    setError(null);
    try {
      await api.pay({ reservationToken, paymentMethod: method, idempotencyKey });
      onSettled();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // A chave já foi processada (ex.: a resposta anterior se perdeu). Consulta o resultado real.
        try {
          const existing = await api.getPaymentByKey(idempotencyKey);
          if (existing.status === 'COMPLETED') return onSettled();
        } catch {
          // cai na mensagem de erro abaixo
        }
      }
      const message = e instanceof Error ? e.message : 'Não foi possível concluir o pagamento.';
      setError(message);
      // Reserva liberada/expirada: a tela precisa refletir isso.
      if (e instanceof ApiError && (e.rawMessage.startsWith('Payment processing failed') || e.rawMessage === 'Invalid or expired reservation')) {
        onSettled();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="payment" onSubmit={submit}>
      <fieldset disabled={submitting}>
        <legend>Forma de pagamento</legend>
        <div className="payment__methods">
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className={m === method ? 'method method--on' : 'method'}>
              <input type="radio" name="method" value={m} checked={m === method} onChange={() => setMethod(m)} />
              {PAYMENT_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn--primary btn--wide" disabled={submitting}>
        {submitting ? 'Processando pagamento…' : price !== null ? `Pagar ${formatBRL(price)}` : 'Pagar'}
      </button>
      <p className="fineprint">Ambiente de demonstração: o gateway é simulado e nenhum dado de cartão é solicitado.</p>
    </form>
  );
}
