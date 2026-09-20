# Ticketing System — Backend (FastAPI)

Conversão do backend original (Next.js Route Handlers) para **Python 3.12+, FastAPI, Pydantic,
SQLAlchemy (assíncrono) e Alembic**, mantendo a mesma API REST, o mesmo schema PostgreSQL e a
mesma lógica de concorrência (locks distribuídos via Redis, transações com `SELECT ... FOR
UPDATE`, idempotência de pagamentos).

## Stack

| Camada          | Tecnologia                          |
| --------------- | ------------------------------------ |
| Framework       | FastAPI + Uvicorn                    |
| Validação       | Pydantic v2                          |
| ORM             | SQLAlchemy 2.0 (async, driver asyncpg) |
| Migrações       | Alembic                              |
| Banco de dados  | PostgreSQL 15                        |
| Cache / Locks   | Redis 7 (redis-py assíncrono)        |

## Como executar

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ajuste se necessário

# Suba Postgres e Redis (veja o docker-compose.yml na raiz do projeto)
docker compose -f ../docker-compose.yml up -d postgres redis

# As migrações rodam automaticamente no startup (MIGRATE_ON_STARTUP=true).
# Para aplicar manualmente: alembic upgrade head
# Para popular dados de exemplo (equivalente à V2 do projeto original): python seed.py

uvicorn app.main:app --reload --port 8000
```

A API sobe em `http://localhost:8000`. Docs automáticas do FastAPI: `/docs` e `/redoc`.

### Docker

```bash
docker compose -f ../docker-compose.yml --profile app up --build
```

## Estrutura

```
app/
  main.py               # app FastAPI, CORS, handlers de erro, lifespan (migrações + job de expiração)
  config.py              # configuração via variáveis de ambiente (pydantic-settings)
  database.py             # engine/sessão assíncrona
  models.py               # modelos SQLAlchemy (events, tickets, reservations, payments)
  schemas.py               # DTOs de entrada/saída (Pydantic)
  mappers.py                # domínio -> DTO de resposta
  errors.py                  # exceções de domínio -> HTTP (BusinessError, ResourceNotFoundError, ...)
  lock.py                     # lock distribuído via Redis (reentrante, mesma semântica do original)
  redis_client.py
  token.py                    # geração do token de reserva
  payment_gateway.py           # gateway de pagamento simulado
  container.py                  # composição das dependências (equivalente ao contexto do Spring)
  repositories/                 # acesso a dados (equivalente aos *Repository do original)
  services/                      # regras de negócio (catalog, reservation, payment)
  jobs/expiration.py              # job periódico de expiração de reservas
  routers/                         # rotas REST (events, reservations, payments, health, internal)
alembic/versions/                  # 0001 = schema inicial, 0002 = permite re-reserva de assento
seed.py                             # dados de exemplo (equivalente a V2__insert_sample_data.sql)
```

## API

Idêntica à do projeto original (mesmos paths, métodos e formatos de resposta em `camelCase`):

### Reservas
| Método   | Endpoint                             |
| -------- | ------------------------------------- |
| `POST`   | `/api/reservations`                   |
| `GET`    | `/api/reservations/{token}`           |
| `DELETE` | `/api/reservations/{token}`           |
| `POST`   | `/api/reservations/{token}/confirm`   |
| `GET`    | `/api/reservations/{token}/validate`  |

### Pagamentos
| Método | Endpoint                             |
| ------ | ------------------------------------- |
| `POST` | `/api/payments`                       |
| `GET`  | `/api/payments/idempotency/{key}`     |
| `GET`  | `/api/payments/reservation/{token}`   |

### Eventos
| Método | Endpoint                    |
| ------ | ---------------------------- |
| `GET`  | `/api/events`                |
| `GET`  | `/api/events/{id}`           |
| `GET`  | `/api/events/{id}/seats`     |

### Operações internas
| Método      | Endpoint                          |
| ----------- | ---------------------------------- |
| `GET`/`POST`| `/internal/expire-reservations`    |
| `GET`       | `/api/actuator/health`             |

## Notas de conversão

* **Locks distribuídos**: `lock.py` reimplementa a mesma semântica de `lock.ts`
  (`SET key token PX ttl NX` + Lua `compare-and-delete`), com reentrância por *coroutine*
  usando `contextvars` (equivalente ao `AsyncLocalStorage` do Node).
* **Transações e `FOR UPDATE`**: cada unidade de trabalho abre sua própria sessão/transação
  (`session_factory()` + `session.begin()`), como `db.transaction()` no original — inclusive a
  chamada ao gateway de pagamento acontece **fora** de qualquer transação.
* **Idempotência de pagamento**: dupla proteção — verificação prévia por `idempotency_key` e a
  constraint `UNIQUE` no banco como última barreira (capturada como `DuplicatePaymentError`).
* **V2 (dados de exemplo)**: virou `seed.py`, executado sob demanda, em vez de uma migração —
  assim o schema fica limpo em produção e os dados de teste continuam a um comando de distância.
