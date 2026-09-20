import { getContainer } from '@/lib/container';
import { apiWithParams } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { token: string };

// GET /api/reservations/{token} — buscar reserva
export const GET = apiWithParams<Params>(async (_req, { token }) => {
  return Response.json(await getContainer().reservations.getReservationResponseByToken(token));
});

// DELETE /api/reservations/{token} — cancelar reserva
export const DELETE = apiWithParams<Params>(async (_req, { token }) => {
  await getContainer().reservations.releaseReservation(token);
  return new Response(null, { status: 204 });
});
