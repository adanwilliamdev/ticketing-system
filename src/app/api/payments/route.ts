import { toPaymentResponse } from '@/lib/dto';
import { getContainer } from '@/lib/container';
import { api, readJson } from '@/lib/http';
import { log } from '@/lib/logger';
import { parsePaymentRequest } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/payments — processar pagamento
export const POST = api(async (req) => {
  const request = parsePaymentRequest(await readJson(req));
  log.info(`Processing payment with idempotency key: ${request.idempotencyKey}`);
  const payment = await getContainer().payments.processPayment(request);
  return Response.json(toPaymentResponse(payment), { status: 201 });
});
