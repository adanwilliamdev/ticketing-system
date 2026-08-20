# Sistema de Agendamento e Pagamentos com Alta Concorrência

Sistema estilo Ticketmaster/Sympla com foco em concorrência, transações, resiliência e consistência de dados.

## 🚀 Tecnologias

- Java 21
- Spring Boot 3.1.5
- PostgreSQL 15
- Redis 7
- Redisson (Lock Distribuído)
- Flyway (Migrações)
- Docker & Docker Compose
- JUnit 5 + Mockito + AssertJ (Testes)

## 📋 Funcionalidades

### Controle de Concorrência
- Pessimistic Locking no banco de dados
- Distributed Locking com Redisson/Redis
- Mecanismo de reserva temporária

### Reserva Temporária
- Reserva por 10 minutos (configurável)
- Expiração automática via job agendado
- Liberação automática de assentos

### Idempotência
- Chave de idempotência para pagamentos
- Prevenção de processamento duplicado
- Resiliência em requisições

## 🏗️ Arquitetura

### Estrutura do Projeto

```
src/main/java/com/ticketing/
├── config/          # Configurações
├── controller/      # Controllers REST
├── dto/             # Data Transfer Objects
├── entity/          # Entidades JPA
├── exception/       # Exceções personalizadas
├── repository/      # Repositórios JPA
├── service/         # Serviços
│   └── impl/        # Implementações
└── util/            # Utilitários

src/test/java/com/ticketing/
├── entity/          # Testes de regras de negócio das entidades
├── service/impl/    # Testes unitários dos serviços (mocks)
└── util/            # Testes de utilitários
```

## 🔧 Como Executar

### Pré-requisitos
- JDK 21
- Docker & Docker Compose
- Maven 3.9+

### Com Docker Compose (recomendado)

```bash
# Subir Postgres e Redis
docker compose -f docker/docker-compose.yml up -d

# Conferir se os containers estão saudáveis
docker compose -f docker/docker-compose.yml ps

# Executar a aplicação
mvn spring-boot:run
```

Para derrubar os serviços e apagar os volumes (útil se as credenciais do banco pararem de bater, por exemplo após uma tentativa anterior com volume antigo):

```bash
docker compose -f docker/docker-compose.yml down -v
```

### Subindo tudo em containers (app incluída)

```bash
docker compose -f docker/docker-compose.yml up --build
```

### Localmente, sem Compose

```bash
# Iniciar PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=ticketing_user -e POSTGRES_PASSWORD=ticketing_pass postgres:15

# Iniciar Redis
docker run -d -p 6379:6379 redis:7

# Executar aplicação
mvn spring-boot:run
```

A API sobe em `http://localhost:8080/api` (o `context-path` é `/api`).

## 🧪 Testes Automatizados

O projeto tem testes unitários para as regras de negócio mais sensíveis do sistema: criação/expiração de reservas e processamento de pagamentos (incluindo idempotência e liberação de assento em caso de falha no gateway).

Esses testes são **unitários puros** (JUnit 5 + Mockito), sem subir Spring context, banco ou Redis — rodam rápido e não precisam do `docker compose` de pé.

### Rodar todos os testes

```bash
mvn test
```

### Rodar uma classe específica

```bash
mvn test -Dtest=ReservationServiceImplTest
mvn test -Dtest=PaymentServiceImplTest
```

### O que está coberto

- **`ReservationServiceImplTest`** — criação de reserva (sucesso e todas as regras de negócio: evento esgotado, assento indisponível, assento já reservado, falha ao adquirir lock), liberação de reserva, validação de reserva expirada/válida, confirmação de reserva e o job de expiração automática.
- **`PaymentServiceImplTest`** — pagamento com sucesso, idempotência (pagamento duplicado), reserva inválida/expirada, falha no gateway (marca pagamento como `FAILED` e libera o assento), e falha ao adquirir lock distribuído.
- **`ReservationTokenGeneratorTest`** — geração de tokens únicos, formato seguro para URL e tamanho consistente.
- **`ReservationTest`** — regra de expiração (`isExpired()`) da entidade.

O projeto já tem `testcontainers` (Postgres) configurado no `pom.xml` como base para testes de integração futuros, caso queira testar o comportamento real do banco/Flyway/locks pessimistas end-to-end — hoje ainda não há testes desse tipo implementados.

## 📚 Endpoints

### Reservas
- `POST /api/reservations` - Criar reserva
- `GET /api/reservations/{token}` - Buscar reserva
- `POST /api/reservations/{token}/confirm` - Confirmar reserva
- `DELETE /api/reservations/{token}` - Cancelar reserva
- `GET /api/reservations/{token}/validate` - Validar reserva

### Pagamentos
- `POST /api/payments` - Processar pagamento
- `GET /api/payments/idempotency/{key}` - Buscar por chave de idempotência
- `GET /api/payments/reservation/{token}` - Buscar por reserva

## 🧪 Testes de Concorrência (carga)

Para testar concorrência sob carga real, use ferramentas como:
- Apache JMeter
- Gatling
- Scripts de teste de carga

Exemplo de teste com JMeter:

```bash
# Criar requisições simultâneas a partir de um plano de teste
jmeter -n -t test-plan.jmx -l results.jtl
```

## 📊 Monitoramento

- Actuator endpoints: `/actuator/health`, `/actuator/metrics`
- Prometheus: `/actuator/prometheus`

## 🛡️ Funcionalidades de Segurança

- Rate limiting (100 requisições/minuto)
- Validação de entrada
- Transações ACID
- Locks distribuídos

## 🔍 Resiliência

- Retry automático em falhas
- Fallbacks para operações críticas
- Timeout configurável

## 📈 Performance

- Pool de conexões otimizado
- Caching com Redis
- Batch operations no JPA
- Índices otimizados no PostgreSQL

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.
