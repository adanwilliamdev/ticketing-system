// Composição das dependências (o papel do contexto do Spring). Criado sob demanda e uma única
// vez por processo; `globalThis` evita recriar pools a cada hot-reload no `next dev`.
import { randomUUID } from 'node:crypto';
import { loadConfig, type AppConfig } from './config';
import { createDatabase } from './db';
import type { Database } from './db-types';
import { RedisLockManager } from './lock';
import { createSimulatedGateway } from './payment-gateway';
import { createRedis, createRedisLockStore, type RedisClient } from './redis';
import { createPostgresRepositories } from './repositories';
import { createCatalogService, type CatalogService } from './services/catalog-service';
import { createPaymentService, type PaymentService } from './services/payment-service';
import { createReservationService, type ReservationService } from './services/reservation-service';
import { generateReservationToken } from './token';

export interface Container {
  config: AppConfig;
  db: Database;
  redis: RedisClient;
  catalog: CatalogService;
  reservations: ReservationService;
  payments: PaymentService;
}

function build(): Container {
  const config = loadConfig();
  const db = createDatabase({ connectionString: config.databaseUrl, maxConnections: config.dbPoolMax });
  const redis = createRedis(config.redisUrl);
  const repos = createPostgresRepositories();
  const locks = new RedisLockManager(createRedisLockStore(redis));
  const now = () => new Date();

  const reservations = createReservationService({
    db,
    repos,
    locks,
    generateToken: generateReservationToken,
    now,
    reservationTimeoutMinutes: config.reservationTimeoutMinutes,
  });
  const payments = createPaymentService({
    db,
    repos,
    reservations,
    locks,
    gateway: createSimulatedGateway(config.paymentGatewayDelayMs),
    now,
    generateId: randomUUID,
  });
  const catalog = createCatalogService({ db, repos });

  return { config, db, redis, catalog, reservations, payments };
}

const holder = globalThis as unknown as { __ticketingContainer?: Container };

export function getContainer(): Container {
  holder.__ticketingContainer ??= build();
  return holder.__ticketingContainer;
}
