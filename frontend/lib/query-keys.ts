// Chaves de query centralizadas — evita strings soltas espalhadas pelos componentes.
export const queryKeys = {
  events: ['events'] as const,
  event: (eventId: number) => ['events', eventId] as const,
  seats: (eventId: number) => ['events', eventId, 'seats'] as const,
  reservation: (token: string) => ['reservations', token] as const,
  payment: (token: string) => ['payments', 'reservation', token] as const,
};
