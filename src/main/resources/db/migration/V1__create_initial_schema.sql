-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date_time TIMESTAMP NOT NULL,
    end_date_time TIMESTAMP NOT NULL,
    location VARCHAR(255),
    total_capacity INTEGER NOT NULL,
    available_tickets INTEGER NOT NULL,
    price DECIMAL(19,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id),
    seat_number VARCHAR(50) NOT NULL,
    section VARCHAR(50),
    row_number VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ticket_event_seat UNIQUE (event_id, seat_number)
);

-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id BIGSERIAL PRIMARY KEY,
    reservation_token VARCHAR(64) NOT NULL UNIQUE,
    event_id BIGINT NOT NULL REFERENCES events(id),
    ticket_id BIGINT NOT NULL UNIQUE REFERENCES tickets(id),
    user_id VARCHAR(100),
    user_email VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    payment_id VARCHAR(100),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    reservation_id BIGINT NOT NULL UNIQUE REFERENCES reservations(id),
    ticket_id BIGINT NOT NULL UNIQUE REFERENCES tickets(id),
    amount DECIMAL(19,2) NOT NULL,
    currency VARCHAR(3),
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20),
    transaction_id VARCHAR(255),
    payment_details JSONB,
    failure_reason TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date_time);
CREATE INDEX idx_tickets_event_status ON tickets(event_id, status);
CREATE INDEX idx_reservations_token ON reservations(reservation_token);
CREATE INDEX idx_reservations_status_expires ON reservations(status, expires_at);
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
CREATE INDEX idx_payments_reservation_id ON payments(reservation_id);

-- Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
