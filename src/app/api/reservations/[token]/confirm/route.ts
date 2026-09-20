import { getContainer } from '@/lib/container';
import { apiWithParams } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/reservations/{token}/confirm — confirmar reserva (estende o prazo para o pagamento)
export const POST = apiWithParams<{ token: string }>(async (_req, { token }) => {
  return Response.json(await getContainer().reservations.confirmReservation(token));
});
