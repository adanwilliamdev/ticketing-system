# Ticketing System — Next.js + TypeScript

Sistema de reserva e pagamento de ingressos com alta concorrência, portado de Spring Boot (Java 17) para
**Next.js 15 (App Router) + React 19 + TypeScript + Node.js**. A API REST mantém os mesmos caminhos, formatos e
regras de negócio do projeto original; foi adicionada uma interface web.

## Como rodar

Requisitos: Node.js ≥ 22 e Docker.

```bash
npm install
npm run infra:up      # Postgres 15 + Redis 7 (mesmas credenciais do projeto original)
npm run dev           # http://localhost:3000 — aplica as migrações ao subir
```

Atalho: `./start.sh` (Linux/macOS) ou `start.bat` (Windows). Tudo em container: `docker compose -f docker/docker-compose.yml --profile app up --build`.

> Se você já rodou o projeto Java com o volume `postgres_data`, use um banco novo (`npm run infra:down -- -v`): o Flyway e este
> runner mantêm históricos de migração diferentes.

| Comando | O que faz |
|---|---|
| `npm test` | 86 testes (`node:test` + `tsx`), sem precisar de Postgres/Redis |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run migrate` | aplica migrações pendentes sem subir o servidor |
| `npm run build && npm start` | produção |

## Mapa Java → TypeScript

| Original | Aqui |
|---|---|
| Spring Web (`@RestController`) | Route Handlers em `src/app/api/**/route.ts` |
| Bean Validation | `src/lib/validation.ts` (mesmas mensagens) |
| `GlobalExceptionHandler` | `src/lib/http.ts` (`mapError`, mesmo JSON de erro) |
| JPA / Hibernate | SQL explícito com `pg` em `src/lib/repositories/` |
| `@Lock(PESSIMISTIC_WRITE)` | `SELECT … FOR UPDATE` |
| `@Transactional` | `db.transaction()` (`src/lib/db.ts`) |
| Redisson `RLock` | `RedisLockManager` (`src/lib/lock.ts`) sobre `ioredis` |
| `@Scheduled` + `@Async` | `instrumentation.ts` → `jobs/expiration.ts` |
| Flyway | `src/lib/migrate.ts` + `migrations/` (V1, V2 idênticos; V3 novo) |
| Actuator `/health` | `GET /api/actuator/health` |

## API

Igual ao original (prefixo `/api`): `POST /reservations` · `GET|DELETE /reservations/{token}` · `POST /reservations/{token}/confirm` ·
`GET /reservations/{token}/validate` · `POST /payments` · `GET /payments/idempotency/{key}` · `GET /payments/reservation/{token}`.

Novos (o original não tinha catálogo; a interface precisa deles): `GET /events`, `GET /events/{id}`, `GET /events/{id}/seats`,
e `GET|POST /internal/expire-reservations` (cron externo, protegido por `CRON_SECRET`).

## Diferenças em relação ao original (todas intencionais)

1. **V3 da migração**: `reservations.ticket_id` e `payments.ticket_id` eram `UNIQUE`, o que impedia reservar de novo um assento
   liberado ou expirado. Agora só vale "uma reserva ATIVA / um pagamento CONCLUÍDO por assento" (índices parciais).
2. **Falha no gateway**: o original tentava gravar `FAILED` e liberar o assento, mas o `@Transactional` desfazia tudo quando a
   exceção subia. Aqui as duas coisas são persistidas antes do erro ser devolvido.
3. **Ordem lock → transação → commit → unlock** (no original o lock era solto antes do commit) e **releitura da reserva sob lock**,
   o que evita cobrar duas vezes e evita que o job de expiração desfaça uma venda concluída.
4. **Gateway fora da transação**: a chamada externa não segura conexão nem locks de linha.
5. `POST /payments` devolve um DTO (o original serializava a entidade JPA com relações bidirecionais).
6. JSON malformado → 400 (no original caía no handler genérico, 500). Datas saem em ISO-8601 UTC (`…Z`).
7. Locks de linha sempre na ordem evento → assento → reserva, para evitar deadlock entre reserva, pagamento e expiração.

Comportamentos herdados de propósito: `confirm` define a expiração para "agora + 5 min" (pode encurtar); reservas liberadas ficam
`CANCELLED` (o status `EXPIRED` nunca é usado); idempotência devolve **409** em vez de repetir o resultado anterior; o status
do evento não é checado ao reservar.

## Não portado

Métricas Prometheus/Actuator (além do health), `@EnableCaching` (nenhum `@Cacheable` era usado), rate limiting (só existia como
configuração, sem implementação) e as chaves de configuração sem uso (`max-reservations-per-user`, `retry-*`, `idempotency-key-ttl`).
Os campos de cartão do `PaymentRequest` são aceitos e descartados: o gateway é simulado e este serviço não deve tocar em dados de cartão.

## Deploy

- **Servidor Node / Docker**: funciona como está (job de expiração em processo).
- **Serverless**: defina `EXPIRATION_JOB_ENABLED=false`, `MIGRATE_ON_STARTUP=false`, rode `npm run migrate` no deploy e agende
  `GET /api/internal/expire-reservations` com `Authorization: Bearer $CRON_SECRET`. Precisa de Redis acessível (ex.: Upstash via `REDIS_URL`).

Os dados de exemplo (V2) têm datas de 2024; a API não valida a data do evento ao reservar, então continuam utilizáveis.
