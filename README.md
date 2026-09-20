# 🎟️ Ticketing System

Sistema de reserva e pagamento de ingressos desenvolvido com **Next.js, TypeScript e PostgreSQL**, com foco em **concorrência, consistência de dados, idempotência e controle de reservas**.

A aplicação oferece uma API REST e uma interface web para gerenciamento de eventos, assentos, reservas e pagamentos.

## 🚀 Stack

| Camada               | Tecnologia                           |
| -------------------- | ------------------------------------ |
| Frontend             | Next.js 15, React 19, TypeScript     |
| Backend              | Next.js Route Handlers, Node.js      |
| Banco de dados       | PostgreSQL 15                        |
| Cache / Locks        | Redis 7, ioredis                     |
| ORM / Acesso a dados | SQL com `pg`                         |
| Validação            | TypeScript + validações customizadas |
| Testes               | Node.js Test Runner + tsx            |
| Infraestrutura       | Docker + Docker Compose              |

## ✨ Funcionalidades

* 🎫 Consulta de eventos
* 💺 Consulta de assentos disponíveis
* 🔒 Reserva de assentos com controle de concorrência
* ⏱️ Expiração automática de reservas
* 💳 Processamento de pagamentos
* 🔁 Idempotência em operações de pagamento
* 🔐 Locks distribuídos utilizando Redis
* 🗄️ Transações e locks de linha no PostgreSQL
* 🌐 API REST
* 🩺 Endpoint de health check
* 🧪 Testes automatizados
* 🐳 Execução completa com Docker

## 📋 Requisitos

* **Node.js 22+**
* **Docker**
* **Docker Compose**

## ⚙️ Como executar

Instale as dependências:

```bash
npm install
```

Suba PostgreSQL e Redis:

```bash
npm run infra:up
```

Inicie a aplicação:

```bash
npm run dev
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

As migrações do banco são aplicadas automaticamente quando configurado para execução no startup.

### Execução com Docker

Para executar toda a aplicação em containers:

```bash
docker compose -f docker/docker-compose.yml --profile app up --build
```

Também existem scripts auxiliares:

```text
start.sh   # Linux / macOS
start.bat  # Windows
```

## 🧪 Testes

Executar todos os testes:

```bash
npm test
```

Os testes não dependem de PostgreSQL ou Redis.

Verificar os tipos TypeScript:

```bash
npm run typecheck
```

Aplicar migrações manualmente:

```bash
npm run migrate
```

Gerar build de produção:

```bash
npm run build
```

Executar em produção:

```bash
npm start
```

## 🔌 API

A API utiliza o prefixo `/api`.

### Reservas

| Método   | Endpoint                             | Descrição            |
| -------- | ------------------------------------ | -------------------- |
| `POST`   | `/api/reservations`                  | Cria uma reserva     |
| `GET`    | `/api/reservations/{token}`          | Consulta uma reserva |
| `DELETE` | `/api/reservations/{token}`          | Cancela uma reserva  |
| `POST`   | `/api/reservations/{token}/confirm`  | Confirma uma reserva |
| `GET`    | `/api/reservations/{token}/validate` | Valida uma reserva   |

### Pagamentos

| Método | Endpoint                            | Descrição                           |
| ------ | ----------------------------------- | ----------------------------------- |
| `POST` | `/api/payments`                     | Processa um pagamento               |
| `GET`  | `/api/payments/idempotency/{key}`   | Consulta uma chave de idempotência  |
| `GET`  | `/api/payments/reservation/{token}` | Consulta o pagamento de uma reserva |

### Eventos

| Método | Endpoint                 | Descrição                      |
| ------ | ------------------------ | ------------------------------ |
| `GET`  | `/api/events`            | Lista eventos                  |
| `GET`  | `/api/events/{id}`       | Consulta um evento             |
| `GET`  | `/api/events/{id}/seats` | Lista os assentos de um evento |

### Operações internas

```text
GET|POST /api/internal/expire-reservations
```

Endpoint utilizado para executar a rotina de expiração de reservas.

O acesso deve ser protegido por `CRON_SECRET`.

### Health Check

```text
GET /api/actuator/health
```

Retorna o estado atual da aplicação e seus componentes essenciais.

## 🔐 Concorrência e consistência

O sistema foi projetado para lidar com múltiplas requisições simultâneas tentando reservar ou pagar pelo mesmo assento.

### Controle de reservas

As operações críticas utilizam:

* Transações PostgreSQL
* `SELECT ... FOR UPDATE`
* Locks distribuídos com Redis
* Ordem consistente de aquisição de locks
* Releitura dos dados dentro da transação

A ordem dos locks segue:

```text
Evento
  ↓
Assento
  ↓
Reserva
```

Isso reduz o risco de deadlocks entre operações concorrentes.

### Regras de reserva

Um assento pode possuir:

* Uma reserva ativa
* Um pagamento concluído

Reservas canceladas ou expiradas não impedem que o assento seja reservado novamente.

## 💳 Pagamentos

O processamento de pagamentos utiliza uma camada de gateway simulada.

O fluxo garante que:

1. A reserva seja validada.
2. O assento seja protegido contra concorrência.
3. O pagamento seja processado.
4. O resultado seja persistido.
5. O estado da reserva seja atualizado.
6. O lock seja liberado após a conclusão da transação.

Os dados de cartão recebidos pela API não são armazenados.

## 🔁 Idempotência

As operações de pagamento suportam chaves de idempotência.

Isso evita que uma mesma operação seja processada inadvertidamente várias vezes em cenários como:

* Reenvio de requisição
* Timeout
* Retry do cliente
* Falha de comunicação

Uma chave já utilizada retorna `409 Conflict`.

## ⏱️ Expiração de reservas

Reservas possuem tempo de expiração.

A aplicação pode executar automaticamente uma rotina responsável por localizar reservas expiradas e liberar os respectivos assentos.

Em ambientes serverless, a rotina pode ser executada externamente através do endpoint:

```text
GET /api/internal/expire-reservations
```

A autenticação utiliza:

```text
Authorization: Bearer $CRON_SECRET
```

## 🗄️ Banco de dados

As alterações estruturais do banco são controladas por migrações versionadas.

Estrutura principal:

```text
migrations/
└── V*.sql
```

Para aplicar migrações manualmente:

```bash
npm run migrate
```

## 📁 Estrutura do projeto

```text
src/
├── app/
│   ├── api/
│   │   ├── events/
│   │   ├── reservations/
│   │   ├── payments/
│   │   └── internal/
│   └── ...
│
├── jobs/
│   └── expiration.ts
│
└── lib/
    ├── repositories/
    ├── db.ts
    ├── http.ts
    ├── lock.ts
    ├── migrate.ts
    └── validation.ts

migrations/
docker/
start.sh
start.bat
```

## 🚀 Deploy

### Node.js / Docker

A aplicação pode ser executada como um servidor Node.js ou através de Docker.

Nesse modelo, a rotina de expiração pode permanecer ativa dentro da aplicação.

### Serverless

Para ambientes serverless, desative os processos executados durante o startup:

```env
EXPIRATION_JOB_ENABLED=false
MIGRATE_ON_STARTUP=false
```

Execute as migrações durante o processo de deploy:

```bash
npm run migrate
```

Depois, configure um cron externo para chamar:

```text
GET /api/internal/expire-reservations
```

O ambiente serverless precisa possuir acesso ao Redis através da variável:

```env
REDIS_URL
```

## 🔑 Variáveis de ambiente

Exemplo:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ticketing
REDIS_URL=redis://localhost:6379

CRON_SECRET=your-secret

MIGRATE_ON_STARTUP=true
EXPIRATION_JOB_ENABLED=true
```

Nunca versione credenciais reais ou arquivos `.env` contendo informações sensíveis.

## 🧠 Arquitetura

O projeto utiliza uma arquitetura baseada em:

```text
                    ┌─────────────────┐
                    │    Next.js      │
                    │   React + API   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
      ┌───────▼────────┐           ┌────────▼───────┐
      │   PostgreSQL   │           │      Redis     │
      │ Dados + Locks  │           │ Locks + Cache  │
      └────────────────┘           └────────────────┘
```

O objetivo é manter as operações críticas consistentes mesmo sob alta concorrência, evitando reservas duplicadas e pagamentos inconsistentes.

## 📌 Status

🚧 **Em desenvolvimento**

Projeto desenvolvido para demonstrar conhecimentos em:

* Next.js
* TypeScript
* Node.js
* APIs REST
* PostgreSQL
* Redis
* Docker
* Controle de concorrência
* Transações
* Idempotência
* Arquitetura de aplicações web
* Testes automatizados

```
