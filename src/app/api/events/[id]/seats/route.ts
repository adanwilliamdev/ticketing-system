import { toSeatResponse } from '@/lib/dto';
import { getContainer } from '@/lib/container';
import { ResourceNotFoundError } from '@/lib/errors';
import { apiWithParams } from '@/lib/http';
import { parseId } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/events/{id}/seats — mapa de assentos com o status atual de cada um
export const GET = apiWithParams<{ id: string }>(async (_req, { id }) => {
  const eventId = parseId(id);
  if (eventId === null) throw new ResourceNotFoundError('Event not found');
  const seats = await getContainer().catalog.listSeats(eventId);
  return Response.json(seats.map(toSeatResponse));
});
