# 🎟️ Ticketing System

<p align="center">
  <img src="src/public/dashboard.png" alt="Dashboard do Ticketing System" width="100%">
</p>

<p align="center">
  <strong>Sistema de reserva e venda de ingressos desenvolvido 100% em Java.</strong>
  <br>
  API REST, interface web, processamento de pagamentos e controle de concorrência.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21">
  <img src="https://img.shields.io/badge/Spring_Boot-3.3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot">
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

## 📌 Sobre o projeto

O **Ticketing System** é uma aplicação web para reserva e venda de ingressos, desenvolvida em Java 21 com Spring Boot. O projeto simula os principais desafios técnicos de uma plataforma de eventos, combinando gerenciamento de assentos, reservas temporárias, processamento de pagamentos e consistência de dados em cenários de concorrência.

A aplicação disponibiliza uma interface web renderizada no servidor com Thymeleaf e uma API REST para operações de consulta, reserva, confirmação e pagamento. A arquitetura utiliza PostgreSQL para persistência, Redis para locks distribuídos e mecanismos de proteção contra operações duplicadas.

O foco do projeto está na aplicação prática de conceitos de **backend, transações, concorrência, idempotência, persistência relacional e conteinerização**, demonstrando como estruturar uma aplicação Java além das operações básicas de CRUD.

## ✨ Funcionalidades

- 🎫 **Gestão de eventos:** consulta de eventos e disponibilidade de ingressos.
- 💺 **Mapa de assentos:** visualização e seleção de assentos disponíveis.
- 📅 **Reservas temporárias:** bloqueio de assentos durante o processo de compra.
- 🔐 **Controle de concorrência:** proteção contra tentativas simultâneas de reservar o mesmo assento.
- 🔒 **Locks distribuídos:** coordenação de operações críticas utilizando Redis.
- 💳 **Processamento de pagamentos:** integração com gateway simulado.
- 🔁 **Idempotência:** prevenção de pagamentos duplicados por meio de chaves de idempotência e restrições no banco.
- ⏱️ **Expiração automática:** liberação de reservas vencidas por meio de tarefas agendadas.
- 🗄️ **Persistência e migrações:** PostgreSQL com Hibernate, JPA e Flyway.
- 📡 **API REST documentada:** especificação OpenAPI e Swagger UI.
- 🩺 **Monitoramento operacional:** endpoints de saúde com Spring Boot Actuator.
- 🐳 **Ambiente conteinerizado:** execução da aplicação e da infraestrutura com Docker Compose.

## 🛠️ Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Linguagem | Java 21 |
| Framework | Spring Boot 3.3 — Web MVC |
| Interface web | Thymeleaf, HTML, CSS e JavaScript |
| Persistência | Spring Data JPA e Hibernate |
| Banco de dados | PostgreSQL 15 |
| Migrações | Flyway |
| Cache e locks | Redis 7 e Spring Data Redis |
| Validação | Jakarta Bean Validation |
| Agendamento | Spring Scheduling (`@Scheduled`) |
| Documentação | springdoc-openapi e Swagger UI |
| Observabilidade | Spring Boot Actuator |
| Infraestrutura | Docker e Docker Compose |
| Testes | JUnit e testes automatizados com Maven |

## 🏗️ Arquitetura

A aplicação utiliza uma arquitetura em camadas, separando a apresentação, os endpoints REST, as regras de negócio, a persistência e os componentes de infraestrutura.

```text
                    ┌──────────────────────────┐
                    │     Aplicação Web        │
                    │  Thymeleaf + API REST    │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │       Controllers        │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │         Services         │
                    │ Catálogo · Reservas      │
                    │ Pagamentos · Expiração   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │     Repositories (JPA)   │
                    └──────────┬───────┬───────┘
                               │       │
                    ┌──────────▼──┐ ┌──▼────────┐
                    │ PostgreSQL  │ │   Redis   │
                    │ Persistência│ │ Locks     │
                    └─────────────┘ └───────────┘
```

### Organização das camadas

- **API:** controllers REST e tratamento padronizado de erros.
- **Web:** páginas renderizadas com Thymeleaf e formatação de dados.
- **Services:** regras de negócio relacionadas a eventos, reservas e pagamentos.
- **Repositories:** acesso aos dados por meio do Spring Data JPA.
- **Domain:** entidades e enums do domínio.
- **Lock:** implementação de locks distribuídos sobre Redis.
- **Gateway:** abstração do gateway de pagamento simulado.
- **Job:** processamento agendado para expiração de reservas.
- **Seed:** criação de dados de demonstração.
- **Config, DTOs, mappers e exceptions:** configuração, transferência de dados, conversões e tratamento de erros.

## ⚙️ Como executar

### Pré-requisitos

- JDK 21
- Maven 3.9 ou superior
- Docker e Docker Compose

### Opção 1: executar tudo com Docker

Na raiz do projeto, execute:

```bash
docker compose --profile app up --build
```

Após a inicialização, acesse:

| Serviço | Endereço |
|---|---|
| Aplicação web | http://localhost:8080 |
| Swagger UI | http://localhost:8080/docs |
| Health Check | http://localhost:8080/api/actuator/health |

Nesse modo, a variável `SEED_ENABLED=true` habilita a criação automática de eventos e assentos de exemplo, conforme a configuração do projeto.

### Opção 2: desenvolvimento local

Primeiro, inicie o PostgreSQL e o Redis:

```bash
docker compose up -d postgres redis
```

Em seguida, execute a aplicação:

**Linux / macOS**

```bash
SEED_ENABLED=true mvn spring-boot:run
```

**Windows PowerShell**

```powershell
$env:SEED_ENABLED="true"
mvn spring-boot:run
```

As migrações do banco são executadas durante a inicialização, conforme a configuração do Flyway.

### Executar os testes

```bash
mvn test
```

> **Atenção:** se você estiver utilizando um banco de dados criado por uma versão anterior do projeto e precisar recriar o schema do zero, `docker compose down -v` remove também os volumes gerenciados pelo Compose, incluindo os dados persistidos. Utilize esse comando somente se puder descartar esses dados.

## 🔧 Configuração

As configurações podem ser definidas por variáveis de ambiente. Consulte o arquivo [`.env.example`](.env.example) para verificar os parâmetros disponíveis.

Entre as principais configurações estão:

| Variável | Finalidade |
|---|---|
| `DB_URL` | URL de conexão com o PostgreSQL |
| `DB_USER` | Usuário do banco de dados |
| `DB_PASSWORD` | Senha do banco de dados |
| `REDIS_HOST` | Endereço do servidor Redis |
| `RESERVATION_TIMEOUT_MINUTES` | Tempo limite de uma reserva |
| `EXPIRATION_JOB_ENABLED` | Habilita ou desabilita o job de expiração |
| `CRON_SECRET` | Segredo de autenticação do endpoint interno |

Os valores padrão devem ser conferidos no `docker-compose.yml` e nos arquivos de configuração da aplicação.

## 🌐 Interface web

| Rota | Descrição |
|---|---|
| `/` | Lista de eventos com ingressos disponíveis |
| `/events/{id}` | Detalhes do evento, mapa de assentos e reserva |
| `/reservations/{token}` | Acompanhamento, pagamento e cancelamento da reserva |

## 📡 API REST

A API disponibiliza endpoints para consulta de eventos, gerenciamento de reservas e operações de pagamento.

### Eventos

| Método | Endpoint |
|---|---|
| `GET` | `/api/events` |
| `GET` | `/api/events/{id}` |
| `GET` | `/api/events/{id}/seats` |

### Reservas

| Método | Endpoint |
|---|---|
| `POST` | `/api/reservations` |
| `GET` | `/api/reservations/{token}` |
| `DELETE` | `/api/reservations/{token}` |
| `POST` | `/api/reservations/{token}/confirm` |
| `GET` | `/api/reservations/{token}/validate` |

### Pagamentos

| Método | Endpoint |
|---|---|
| `POST` | `/api/payments` |
| `GET` | `/api/payments/idempotency/{key}` |
| `GET` | `/api/payments/reservation/{token}` |

### Operações internas

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` / `POST` | `/internal/expire-reservations` | Dispara a expiração de reservas, com autenticação por Bearer Token |
| `GET` | `/api/actuator/health` | Verifica a saúde da aplicação e de suas dependências |

O endpoint interno de expiração utiliza o segredo definido em `CRON_SECRET`.

Os erros da API seguem o formato padronizado:

```json
{
  "timestamp": "...",
  "status": 409,
  "error": "Conflict",
  "message": "...",
  "details": {}
}
```

Os valores são ilustrativos e podem variar conforme o erro retornado.

## 🔒 Concorrência e consistência de dados

Um dos principais objetivos do projeto é preservar a consistência das reservas e dos pagamentos, inclusive quando várias requisições tentam modificar os mesmos recursos simultaneamente.

### Locks distribuídos com Redis

O sistema utiliza locks distribuídos baseados em `SET NX PX`, com remoção atômica por script Lua, tempo de espera limitado, lease e suporte à reentrância por thread.

### Bloqueio pessimista no banco

As operações críticas utilizam `SELECT ... FOR UPDATE` por meio dos recursos de lock do JPA, seguindo uma ordem consistente de acesso:

1. Evento.
2. Assento.
3. Reserva.

Essa estratégia ajuda a reduzir conflitos e prevenir deadlocks.

### Transações e pagamentos

- Os locks são adquiridos antes da transação e liberados após o commit.
- A chamada ao gateway de pagamento ocorre fora da transação de banco, evitando manter conexões e locks de linha durante a chamada externa.
- A idempotência é protegida por verificações da chave e por uma restrição `UNIQUE` no banco de dados.
- Índices parciais únicos protegem as regras de reserva ativa por assento e de pagamento concluído por assento.
- Reservas vencidas podem ser processadas pelo job agendado ou pelo endpoint interno autenticado.

Esses mecanismos atuam em conjunto para reduzir reservas duplicadas, pagamentos repetidos e inconsistências de estado.

## 📁 Estrutura do projeto

```text
ticketing-system/
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── src/
    ├── main/
    │   ├── java/com/ticketing/
    │   │   ├── api/
    │   │   ├── web/
    │   │   ├── service/
    │   │   ├── repository/
    │   │   ├── domain/
    │   │   ├── lock/
    │   │   ├── gateway/
    │   │   ├── job/
    │   │   ├── seed/
    │   │   ├── dto/
    │   │   ├── mapper/
    │   │   ├── config/
    │   │   └── exception/
    │   └── resources/
    │       ├── db/migration/
    │       ├── templates/
    │       ├── static/
    │       └── application.yml
    ├── public/
    │   └── dashboard.png
    └── test/
        └── java/
```

*Estrutura ilustrativa. A organização real dos diretórios deve corresponder aos arquivos existentes no repositório.*

## 🎯 Objetivos técnicos

Este projeto demonstra conhecimentos práticos em:

- Desenvolvimento backend com Java 21 e Spring Boot.
- Construção e documentação de APIs REST.
- Modelagem relacional e persistência com PostgreSQL.
- Gerenciamento de schema com Flyway.
- Transações e controle de concorrência.
- Locks distribuídos com Redis.
- Idempotência e integridade de operações financeiras simuladas.
- Agendamento de tarefas e processamento de reservas expiradas.
- Testes automatizados.
- Docker e Docker Compose.

## 📄 Licença

Este projeto está disponível sob a licença definida no repositório.
