"""allow seat rereservation

Equivalente a migrations/V3__allow_seat_rereservation.sql do projeto original.

No schema original (0001), reservations.ticket_id e payments.ticket_id são UNIQUE. Na prática
isso limita cada assento a UMA reserva e UM pagamento em toda a sua vida: depois que uma reserva
é cancelada ou expira e o assento volta a AVAILABLE, a reserva seguinte violaria a unicidade.

Aqui a exclusividade passa a valer só para o que realmente precisa ser exclusivo: uma reserva
ATIVA por assento e um pagamento CONCLUÍDO por assento.

(Não há equivalente à V2__insert_sample_data.sql do original aqui — os dados de exemplo ficam em
seed.py, executado sob demanda, em vez de rodar em toda migração.)

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-01 00:00:01

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_ticket_id_key")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uk_reservations_active_ticket "
        "ON reservations (ticket_id) WHERE status = 'ACTIVE'"
    )

    op.execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_ticket_id_key")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uk_payments_completed_ticket "
        "ON payments (ticket_id) WHERE status = 'COMPLETED'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uk_payments_completed_ticket")
    op.execute("ALTER TABLE payments ADD CONSTRAINT payments_ticket_id_key UNIQUE (ticket_id)")

    op.execute("DROP INDEX IF EXISTS uk_reservations_active_ticket")
    op.execute("ALTER TABLE reservations ADD CONSTRAINT reservations_ticket_id_key UNIQUE (ticket_id)")
