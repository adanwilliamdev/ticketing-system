// Mensagens de erro do backend, em inglês (ver app/errors.py), traduzidas para exibição.
// Comparação exata de string: simples e suficiente para o conjunto fechado de erros da API.

const KNOWN_MESSAGES: Record<string, string> = {
  'Event not found': 'Evento não encontrado.',
  'Seat not found': 'Assento não encontrado.',
  'Reservation not found': 'Reserva não encontrada.',
  'Payment not found': 'Pagamento não encontrado.',
  'No tickets available for this event': 'Não há mais ingressos disponíveis para este evento.',
  'Seat is not available': 'Este assento não está mais disponível.',
  'Seat already has an active reservation': 'Este assento já tem uma reserva ativa.',
  'Could not acquire lock for seat reservation': 'Muita gente tentando reservar esse assento agora. Tente de novo.',
  'Reservation is not active': 'Esta reserva não está mais ativa.',
  'Reservation has expired': 'Esta reserva expirou.',
  'Invalid or expired reservation': 'Reserva inválida ou expirada.',
  'Could not acquire lock for reservation': 'Não foi possível processar agora. Tente novamente em instantes.',
  'Could not acquire lock for payment processing': 'Não foi possível processar o pagamento agora. Tente novamente.',
  'Payment already processed': 'Este pagamento já foi processado.',
  'Reservation is no longer active': 'A reserva não está mais ativa.',
};

export function translateApiMessage(message: string): string {
  if (message in KNOWN_MESSAGES) return KNOWN_MESSAGES[message];
  if (message.startsWith('Payment processing failed:')) {
    return 'O pagamento foi recusado pela operadora. Tente novamente ou use outro método.';
  }
  return message;
}
