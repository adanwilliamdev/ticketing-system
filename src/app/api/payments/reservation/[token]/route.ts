import { toPaymentResponse } from '@/lib/dto';
import { getContainer } from '@/lib/container';
import { apiWithParams } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/payments/reservation/{token}
export const GET = apiWithParams<{ token: string }>(async (_req, { token }) => {
  return Response.json(toPaymentResponse(await getContainer().payments.getPaymentByReservationToken(token)));
});
