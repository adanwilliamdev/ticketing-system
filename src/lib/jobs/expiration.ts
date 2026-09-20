import { log } from '../logger';

/**
 * Equivalente ao @Scheduled(fixedDelay = 60000): roda uma vez de imediato e agenda a próxima
 * execução `intervalMs` DEPOIS que a anterior terminar (sem sobreposição).
 */
export function startExpirationJob(options: { run: () => Promise<unknown>; intervalMs: number }): { stop(): void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await options.run();
    } catch (error) {
      log.error('Reservation expiration job failed', error);
    }
    if (!stopped) timer = setTimeout(() => void tick(), options.intervalMs);
  };

  void tick();

  return {
    stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
