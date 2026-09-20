import { timingSafeEqual } from 'node:crypto';
import { getContainer } from '@/lib/container';
import { api } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(header: string | null, secret: string): boolean {
  if (secret === '' || header === null) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Alternativa ao job em processo (EXPIRATION_JOB_ENABLED=false) para hospedagem serverless:
// agende uma chamada periódica com "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET, fica desativado.
const handler = api(async (req) => {
  const { reservations, config } = getContainer();
  if (!authorized(req.headers.get('authorization'), config.cronSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const released = await reservations.expireReservations();
  return Response.json({ released });
});

export const GET = handler;
export const POST = handler;
