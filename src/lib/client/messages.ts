// A API devolve as mensagens do projeto original (em inglês); a interface as traduz.
const KNOWN: Array<[RegExp, string]> = [
  [/^Seat is not available$/, 'Esse assento acabou de ser reservado por outra pessoa. Escolha outro.'],
  [/^Seat already has an active reservation$/, 'Esse assento acabou de ser reservado por outra pessoa. Escolha outro.'],
  [/^No tickets available/, 'Os ingressos deste evento esgotaram.'],
  [/^Seat not found$/, 'Assento não encontrado.'],
  [/^Event not found$/, 'Evento não encontrado.'],
  [/^Reservation not found$/, 'Reserva não encontrada. O link pode estar incorreto.'],
  [/^Could not acquire lock/, 'O sistema está com muitos acessos. Tente novamente em instantes.'],
  [/^Invalid or expired reservation$/, 'Sua reserva expirou ou já foi concluída.'],
  [/^Reservation is no longer active$/, 'Sua reserva não está mais ativa.'],
  [/^Payment already processed$/, 'Este pagamento já foi processado.'],
  [/^Payment processing failed/, 'O pagamento não foi aprovado e a reserva foi liberada. Escolha o assento novamente.'],
  [/^Invalid email format$/, 'Informe um e-mail válido ou deixe o campo vazio.'],
  [/^NETWORK$/, 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'],
];

export function translateApiMessage(message: string): string {
  for (const [pattern, text] of KNOWN) if (pattern.test(message)) return text;
  return message.startsWith('HTTP ') || message === 'An unexpected error occurred'
    ? 'Algo deu errado do nosso lado. Tente novamente em instantes.'
    : message;
}
