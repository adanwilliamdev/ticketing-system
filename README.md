# 🎟️ Ticketing System

Sistema completo de **reserva e venda de ingressos**, 100% em **Java**: API REST, páginas web renderizadas no servidor, processamento agendado e controle de concorrência.

## 🚀 Stack

| Camada            | Tecnologia                                                    |
| ----------------- | ------------------------------------------------------------- |
| Linguagem         | Java 21                                                       |
| Framework         | Spring Boot 3.3 (Web MVC)                                     |
| Páginas           | Thymeleaf + CSS/JavaScript puros (sem etapa de build)         |
| Persistência      | Spring Data JPA (Hibernate)                                   |
| Migrações         | Flyway                                                        |
| Banco de dados    | PostgreSQL 15                                                 |
| Cache / Locks     | Redis 7 (Spring Data Redis)                                   |
| Validação         | Jakarta Bean Validation                                       |
| Agendamento       | Spring `@Scheduled`                                           |
| Documentação      | springdoc-openapi (Swagger UI)                                |
| Observabilidade   | Spring Boot Actuator                                          |
| Infra             | Docker e Docker Compose                                       |

## ✨ Funcionalidades

* 🎫 Reserva e venda de ingressos com mapa de assentos
* 🔐 Controle de concorrência
* 🔒 Locks distribuídos (Redis, reentrantes, com lease)
* 💳 Idempotência de pagamentos
* ⏱️ Expiração automática de reservas
* 🗄️ Persistência com PostgreSQL e migrações versionadas
* 📡 API REST com documentação automática
* 🐳 Ambiente completo com Docker

## 🏗️ Arquitetura

```text
┌───────────────────────────────────────────┐
│            Aplicação Spring Boot          │
│                                           │
│  Páginas (Thymeleaf)   API REST (/api/**) │
│            └──────┬───────────┘           │
│               Serviços                    │
│   Catálogo · Reservas · Pagamentos        │
│       Locks · Gateway · Job de expiração  │
│               Repositórios (JPA)          │
└──────────────┬───────────────┬────────────┘
               ▼               ▼
        ┌────────────┐   ┌────────────┐
        │ PostgreSQL │   │   Redis    │
        │     15     │   │     7      │
        └────────────┘   └────────────┘
```

## ▶️ Como executar

Pré-requisitos: **JDK 21**, **Maven 3.9+** e **Docker**.

### Tudo com Docker

```bash
docker compose --profile app up --build
```

Após a inicialização:

* **Aplicação:** http://localhost:8080
* **Swagger UI:** http://localhost:8080/docs
* **Health:** http://localhost:8080/api/actuator/health

Nesse modo os eventos e assentos de exemplo são criados automaticamente (`SEED_ENABLED=true`).

### Desenvolvimento local

```bash
# infraestrutura
docker compose up -d postgres redis

# aplicação (as migrações rodam no startup; SEED_ENABLED cria os dados de exemplo)
SEED_ENABLED=true mvn spring-boot:run
```

No Windows (PowerShell): `$env:SEED_ENABLED="true"; mvn spring-boot:run`

### Testes

```bash
mvn test
```

> Se você já tem um banco criado por uma versão anterior do projeto, suba um banco novo
> (`docker compose down -v`): o Flyway cria o schema do zero.

## ⚙️ Configuração

Tudo é configurável por variável de ambiente; os padrões batem com o `docker-compose.yml`. Veja [`.env.example`](.env.example) para a lista completa (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `REDIS_HOST`, `RESERVATION_TIMEOUT_MINUTES`, `EXPIRATION_JOB_ENABLED`, `CRON_SECRET`, ...).

## 📁 Estrutura

```text
ticketing-system/
├── pom.xml
├── Dockerfile
├── docker-compose.yml
└── src/
    ├── main/
    │   ├── java/com/ticketing/
    │   │   ├── api/          # controllers REST + tratamento de erros
    │   │   ├── web/          # páginas HTML (Thymeleaf) e formatação
    │   │   ├── service/      # catálogo, reservas, pagamentos
    │   │   ├── repository/   # Spring Data JPA
    │   │   ├── domain/       # entidades e enums
    │   │   ├── lock/         # lock distribuído sobre Redis
    │   │   ├── gateway/      # gateway de pagamento (simulado)
    │   │   ├── job/          # expiração de reservas
    │   │   ├── seed/         # dados de exemplo
    │   │   ├── dto/ mapper/ config/ exception/
    │   └── resources/
    │       ├── db/migration/ # Flyway
    │       ├── templates/    # páginas Thymeleaf
    │       ├── static/       # CSS e JavaScript
    │       └── application.yml
    └── test/java/            # testes unitários
```

## 🌐 Páginas

| Rota                       | Descrição                                              |
| -------------------------- | ------------------------------------------------------ |
| `/`                        | Lista de eventos com ingressos disponíveis             |
| `/events/{id}`             | Detalhe do evento, mapa de assentos e reserva          |
| `/reservations/{token}`    | Contagem regressiva, pagamento e cancelamento          |

## 📡 API REST

### Eventos
| Método | Endpoint                 |
| ------ | ------------------------ |
| `GET`  | `/api/events`            |
| `GET`  | `/api/events/{id}`       |
| `GET`  | `/api/events/{id}/seats` |

### Reservas
| Método   | Endpoint                              |
| -------- | ------------------------------------- |
| `POST`   | `/api/reservations`                   |
| `GET`    | `/api/reservations/{token}`           |
| `DELETE` | `/api/reservations/{token}`           |
| `POST`   | `/api/reservations/{token}/confirm`   |
| `GET`    | `/api/reservations/{token}/validate`  |

### Pagamentos
| Método | Endpoint                            |
| ------ | ----------------------------------- |
| `POST` | `/api/payments`                     |
| `GET`  | `/api/payments/idempotency/{key}`   |
| `GET`  | `/api/payments/reservation/{token}` |

### Operações internas
| Método        | Endpoint                         | Observação                                        |
| ------------- | -------------------------------- | ------------------------------------------------- |
| `GET`/`POST`  | `/internal/expire-reservations`  | `Authorization: Bearer <CRON_SECRET>`             |
| `GET`         | `/api/actuator/health`           | Health do banco e do Redis                        |

Erros seguem o formato `{ timestamp, status, error, message, details? }`.

## 🔒 Concorrência e consistência

* **Lock distribuído no Redis** (`SET NX PX` + remoção atômica por script Lua), com espera máxima, lease e reentrância por thread.
* **`SELECT ... FOR UPDATE`** (lock pessimista do JPA) sempre na mesma ordem: evento → assento → reserva, evitando deadlocks.
* **Ordem de operação em escritas:** lock distribuído → transação → commit → libera o lock.
* **Cobrança fora de transação:** a chamada ao gateway não segura conexão nem locks de linha.
* **Idempotência de pagamentos:** verificação prévia por chave + restrição `UNIQUE` no banco como última barreira (HTTP 409).
* **Reserva ativa única por assento** e **um pagamento concluído por assento**, garantidos por índices parciais únicos.
* **Expiração automática:** job agendado (ou chamada externa a `/internal/expire-reservations`).

## 📄 Licença

Este projeto está disponível sob a licença definida no repositório.
