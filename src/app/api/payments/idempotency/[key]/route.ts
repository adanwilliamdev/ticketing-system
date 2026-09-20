import { toPaymentResponse } from '@/lib/dto';
import { getContainer } from '@/lib/container';
import { apiWithParams } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/payments/idempotency/{key}
export const GET = apiWithParams<{ key: string }>(async (_req, { key }) => {
  return Response.json(toPaymentResponse(await getContainer().payments.getPaymentByIdempotencyKey(key)));
});
