import { getContainer } from '@/lib/container';
import { apiWithParams } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/reservations/{token}/validate — corpo é um boolean, como no original
export const GET = apiWithParams<{ token: string }>(async (_req, { token }) => {
  return Response.json(await getContainer().reservations.isReservationValid(token));
});
