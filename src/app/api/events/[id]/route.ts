import { toEventResponse } from '@/lib/dto';
import { getContainer } from '@/lib/container';
import { ResourceNotFoundError } from '@/lib/errors';
import { apiWithParams } from '@/lib/http';
import { parseId } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/events/{id}
export const GET = apiWithParams<{ id: string }>(async (_req, { id }) => {
  const eventId = parseId(id);
  if (eventId === null) throw new ResourceNotFoundError('Event not found');
  return Response.json(toEventResponse(await getContainer().catalog.getEvent(eventId)));
});
