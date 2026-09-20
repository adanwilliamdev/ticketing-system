# 🎟️ Ticketing System

Sistema completo de **reserva e venda de ingressos**, desenvolvido com arquitetura moderna, API REST, processamento assíncrono e controle de concorrência.

## 🚀 Stack

### Frontend

<div align="left">

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge\&logo=next.js\&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge\&logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge\&logo=tailwindcss\&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-UI-000000?style=for-the-badge)](https://ui.shadcn.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=for-the-badge\&logo=reactquery\&logoColor=white)](https://tanstack.com/query)

</div>

### Backend

<div align="left">

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge\&logo=python\&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge\&logo=fastapi\&logoColor=white)](https://fastapi.tiangolo.com/)
[![Pydantic](https://img.shields.io/badge/Pydantic-2-E92063?style=for-the-badge)](https://docs.pydantic.dev/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=for-the-badge\&logo=sqlalchemy\&logoColor=white)](https://www.sqlalchemy.org/)
[![Alembic](https://img.shields.io/badge/Alembic-Migrations-1F2937?style=for-the-badge)](https://alembic.sqlalchemy.org/)

</div>

### Database & Infrastructure

<div align="left">

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge\&logo=postgresql\&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge\&logo=redis\&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge\&logo=docker\&logoColor=white)](https://www.docker.com/)

</div>

## ✨ Funcionalidades

* 🎫 Reserva e venda de ingressos
* 🔐 Controle de concorrência
* 🔒 Locks distribuídos
* 💳 Idempotência de pagamentos
* ⏱️ Expiração automática de reservas
* 🗄️ Persistência com PostgreSQL
* ⚡ Cache e controle distribuído com Redis
* 🔄 Processamento assíncrono
* 📡 API REST com documentação automática
* 🐳 Ambiente completo com Docker

## 🏗️ Arquitetura

```text
┌──────────────────────────────┐
│           Frontend           │
│                              │
│ Next.js · TypeScript         │
│ Tailwind · shadcn/ui         │
│ TanStack Query               │
└──────────────┬───────────────┘
               │
               │ REST API
               │ JSON
               ▼
┌──────────────────────────────┐
│           Backend            │
│                              │
│ Python · FastAPI             │
│ Pydantic · SQLAlchemy        │
│ Alembic                      │
└──────────────┬───────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────┐ ┌──────────────┐
│ PostgreSQL   │ │    Redis     │
│      15      │ │      7       │
└──────────────┘ └──────────────┘
```

## ▶️ Como executar

### Docker

```bash
docker compose --profile app up --build
```

Após a inicialização:

* **Frontend:** http://localhost:3000
* **Backend:** http://localhost:8000
* **API Docs:** http://localhost:8000/docs

### Desenvolvimento local

Inicialize os serviços de infraestrutura:

```bash
docker compose up -d postgres redis
```

#### Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

python seed.py

uvicorn app.main:app --reload --port 8000
```

#### Frontend

Em outro terminal:

```bash
cd frontend

npm install
npm run dev
```

## 📁 Estrutura

```text
ticketing-system/
│
├── backend/
│   ├── app/
│   ├── alembic/
│   ├── requirements.txt
│   └── seed.py
│
├── frontend/
│   ├── app/
│   ├── components/
│   └── package.json
│
└── docker-compose.yml
```

## 🔒 Concorrência e consistência

O sistema utiliza mecanismos para garantir consistência durante operações simultâneas, incluindo:

* Locks distribuídos com Redis
* `SELECT ... FOR UPDATE`
* Controle de idempotência em pagamentos
* Expiração automática de reservas
* Operações assíncronas no acesso ao banco de dados

## 📚 Documentação

A API possui documentação interativa disponível através do Swagger:

```text
http://localhost:8000/docs
```

Documentações específicas de cada camada também estão disponíveis nos diretórios:

```text
backend/README.md
frontend/README.md
```

## 📄 Licença

Este projeto está disponível sob a licença definida no repositório.
