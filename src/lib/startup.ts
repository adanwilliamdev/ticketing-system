import { getContainer } from './container';
import { startExpirationJob } from './jobs/expiration';
import { log } from './logger';
import { runMigrations } from './migrate';

const holder = globalThis as unknown as { __ticketingStarted?: boolean };

/** Chamado uma vez por processo pelo instrumentation.ts do Next (equivalente a Flyway + @EnableScheduling). */
export async function startBackgroundTasks(): Promise<void> {
  if (holder.__ticketingStarted) return; // hot-reload do `next dev` reexecuta register()
  holder.__ticketingStarted = true;

  const container = getContainer();
  const { config } = container;

  if (config.migrateOnStartup) {
    try {
      const applied = await runMigrations(config.databaseUrl);
      log.info(applied.length > 0 ? `Migrações aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado');
    } catch (error) {
      log.error('Falha ao aplicar migrações — o PostgreSQL está no ar? (npm run infra:up)', error);
      throw error;
    }
  }

  if (config.expirationJobEnabled) {
    startExpirationJob({ run: () => container.reservations.expireReservations(), intervalMs: config.expirationIntervalMs });
    log.info(`Job de expiração de reservas ativo (a cada ${config.expirationIntervalMs} ms)`);
  }
}
