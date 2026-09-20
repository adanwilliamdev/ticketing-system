// Equivalente ao application.yml. Tudo pode ser sobrescrito por variáveis de ambiente;
// os padrões batem com o docker/docker-compose.yml.

export interface AppConfig {
  databaseUrl: string;
  redisUrl: string;
  dbPoolMax: number;
  reservationTimeoutMinutes: number;
  paymentGatewayDelayMs: number;
  expirationJobEnabled: boolean;
  expirationIntervalMs: number;
  migrateOnStartup: boolean;
  cronSecret: string;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Valor inválido para ${name}: "${raw}" (esperado inteiro >= 0)`);
  }
  return value;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://ticketing_user:ticketing_pass@localhost:5432/ticketing_db',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    dbPoolMax: readInt('DB_POOL_MAX', 20),
    reservationTimeoutMinutes: readInt('RESERVATION_TIMEOUT_MINUTES', 10),
    paymentGatewayDelayMs: readInt('PAYMENT_GATEWAY_DELAY_MS', 2000),
    expirationJobEnabled: readBool('EXPIRATION_JOB_ENABLED', true),
    expirationIntervalMs: readInt('EXPIRATION_INTERVAL_MS', 60_000),
    migrateOnStartup: readBool('MIGRATE_ON_STARTUP', true),
    cronSecret: process.env.CRON_SECRET ?? '',
  };
}
