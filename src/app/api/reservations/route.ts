import { getContainer } from '@/lib/container';
import { api, readJson } from '@/lib/http';
import { log } from '@/lib/logger';
import { parseCreateReservation } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/reservations — criar reserva
export const POST = api(async (req) => {
  const request = parseCreateReservation(await readJson(req));
  log.info(`Creating reservation for event: ${request.eventId}, seat: ${request.seatNumber}`);
  const response = await getContainer().reservations.createReservation(request);
  return Response.json(response, { status: 201 });
});
