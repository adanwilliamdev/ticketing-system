const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value: number): string {
  return brl.format(value);
}

// Os horários dos eventos são gravados sem fuso ("20:00" no local do evento). Exibir em UTC
// mostra exatamente o horário cadastrado, sem deslocar pelo fuso do navegador.
export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso));
}

export function eventDateParts(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'UTC' }).format(date),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date).replace('.', ''),
  };
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** "A012" → "12" (o número que cabe dentro do assento no mapa). */
export function seatShortLabel(seatNumber: string): string {
  const digits = seatNumber.replace(/^\D+/, '').replace(/^0+(?=\d)/, '');
  return digits === '' ? seatNumber : digits;
}

/** "Row 3" → "Fila 3" */
export function rowLabel(rowNumber: string | null): string {
  if (!rowNumber) return 'Fila';
  return rowNumber.replace(/^Row\s+/i, 'Fila ');
}

export const PAYMENT_METHOD_LABELS = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto',
  PAYPAL: 'PayPal',
} as const;
