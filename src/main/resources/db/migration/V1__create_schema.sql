-- Schema do sistema de ingressos.
-- Todas as colunas de data/hora são TIMESTAMP sem fuso e guardam sempre UTC.

CREATE TABLE events (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(255)   NOT NULL,
    description       TEXT,
    start_date_time   TIMESTAMP      NOT NULL,
    end_date_time     TIMESTAMP      NOT NULL,
    location          VARCHAR(255),
    total_capacity    INTEGER        NOT NULL,
    available_tickets INTEGER        NOT NULL,
    price             NUMERIC(19, 2) NOT NULL,
    status            VARCHAR(20)    NOT NULL,
    version           INTEGER        NOT NULL DEFAULT 0,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_status ON events (status);
CREATE INDEX idx_events_start_date ON events (start_date_time);

CREATE TABLE tickets (
    id          BIGSERIAL PRIMARY KEY,
    event_id    BIGINT      NOT NULL REFERENCES events (id),
    seat_number VARCHAR(50) NOT NULL,
    section     VARCHAR(50),
    row_number  VARCHAR(50),
    status      VARCHAR(20) NOT NULL,
    version     INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ticket_event_seat UNIQUE (event_id, seat_number)
);

CREATE INDEX idx_tickets_event_status ON tickets (event_id, status);

CREATE TABLE reservations (
    id                BIGSERIAL PRIMARY KEY,
    reservation_token VARCHAR(64) NOT NULL,
    event_id          BIGINT      NOT NULL REFERENCES events (id),
    ticket_id         BIGINT      NOT NULL REFERENCES tickets (id),
    user_id           VARCHAR(100),
    user_email        VARCHAR(255),
    expires_at        TIMESTAMP   NOT NULL,
    status            VARCHAR(20) NOT NULL,
    created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reservations_token UNIQUE (reservation_token)
);

CREATE INDEX idx_reservations_status_expires ON reservations (status, expires_at);

-- Um assento pode ser reservado várias vezes ao longo da vida (reserva cancelada/expirada libera o assento),
-- mas só pode ter UMA reserva ATIVA por vez.
CREATE UNIQUE INDEX uk_reservations_active_ticket ON reservations (ticket_id) WHERE status = 'ACTIVE';

CREATE TABLE payments (
    id              BIGSERIAL PRIMARY KEY,
    payment_id      VARCHAR(100),
    idempotency_key VARCHAR(255)   NOT NULL,
    reservation_id  BIGINT         NOT NULL REFERENCES reservations (id),
    ticket_id       BIGINT         NOT NULL REFERENCES tickets (id),
    amount          NUMERIC(19, 2) NOT NULL,
    currency        VARCHAR(3),
    status          VARCHAR(20)    NOT NULL,
    payment_method  VARCHAR(20),
    transaction_id  VARCHAR(255),
    failure_reason  TEXT,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_payments_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT uk_payments_reservation UNIQUE (reservation_id)
);

-- No máximo um pagamento CONCLUÍDO por assento.
CREATE UNIQUE INDEX uk_payments_completed_ticket ON payments (ticket_id) WHERE status = 'COMPLETED';
