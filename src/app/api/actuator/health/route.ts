import { getContainer } from '@/lib/container';
import { api } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Component = 'UP' | 'DOWN';

async function check(probe: () => Promise<unknown>): Promise<Component> {
  try {
    await probe();
    return 'UP';
  } catch {
    return 'DOWN';
  }
}

// GET /api/actuator/health — substitui o health do Spring Actuator (usado no healthcheck do Docker)
export const GET = api(async () => {
  const { db, redis } = getContainer();
  const [database, cache] = await Promise.all([check(() => db.pool.query('SELECT 1')), check(() => redis.ping())]);
  const up = database === 'UP' && cache === 'UP';
  return Response.json(
    { status: up ? 'UP' : 'DOWN', components: { db: database, redis: cache } },
    { status: up ? 200 : 503 },
  );
});
