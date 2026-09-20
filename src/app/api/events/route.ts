import { toEventResponse } from '@/lib/dto';
import { getContainer } from '@/lib/container';
import { api } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/events — eventos publicados com ingressos disponíveis (novo; o original não tinha catálogo)
export const GET = api(async () => {
  const events = await getContainer().catalog.listAvailableEvents();
  return Response.json(events.map(toEventResponse));
});
