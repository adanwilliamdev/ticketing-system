-- V3: permite reservar novamente um assento liberado/expirado e registrar pagamentos que falharam.
--
-- No schema original (V1), reservations.ticket_id e payments.ticket_id são UNIQUE. Na prática isso
-- limita cada assento a UMA reserva e UM pagamento em toda a sua vida: depois que uma reserva é
-- cancelada ou expira e o assento volta a AVAILABLE, a reserva seguinte violaria a unicidade.
--
-- Aqui a exclusividade passa a valer só para o que realmente precisa ser exclusivo:
-- uma reserva ATIVA por assento e um pagamento CONCLUÍDO por assento.
-- V1 e V2 permanecem exatamente como no projeto original.

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_ticket_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uk_reservations_active_ticket
    ON reservations (ticket_id) WHERE status = 'ACTIVE';

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_ticket_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uk_payments_completed_ticket
    ON payments (ticket_id) WHERE status = 'COMPLETED';
