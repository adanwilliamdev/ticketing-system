// Logger mínimo. Defina LOG_LEVEL=silent para desligar (os testes fazem isso).

function enabled(): boolean {
  return process.env.LOG_LEVEL !== 'silent';
}

function stamp(level: string, message: string): string {
  return `${new Date().toISOString()} ${level} - ${message}`;
}

export const log = {
  info(message: string): void {
    if (enabled()) console.log(stamp('INFO', message));
  },
  warn(message: string): void {
    if (enabled()) console.warn(stamp('WARN', message));
  },
  error(message: string, error?: unknown): void {
    if (!enabled()) return;
    const detail = error instanceof Error ? (error.stack ?? error.message) : error === undefined ? '' : String(error);
    console.error(stamp('ERROR', message) + (detail ? `\n${detail}` : ''));
  },
};
