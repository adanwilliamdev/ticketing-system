"""initial schema

Equivalente a migrations/V1__create_initial_schema.sql do projeto original.

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("start_date_time", sa.DateTime, nullable=False),
        sa.Column("end_date_time", sa.DateTime, nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("total_capacity", sa.Integer, nullable=False),
        sa.Column("available_tickets", sa.Integer, nullable=False),
        sa.Column("price", sa.Numeric(19, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("version", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "tickets",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.BigInteger, sa.ForeignKey("events.id"), nullable=False),
        sa.Column("seat_number", sa.String(50), nullable=False),
        sa.Column("section", sa.String(50), nullable=True),
        sa.Column("row_number", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("version", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("event_id", "seat_number", name="uk_ticket_event_seat"),
    )

    op.create_table(
        "reservations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("reservation_token", sa.String(64), nullable=False, unique=True),
        sa.Column("event_id", sa.BigInteger, sa.ForeignKey("events.id"), nullable=False),
        sa.Column("ticket_id", sa.BigInteger, sa.ForeignKey("tickets.id"), nullable=False, unique=True),
        sa.Column("user_id", sa.String(100), nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("payment_id", sa.String(100), nullable=True),
        sa.Column("idempotency_key", sa.String(255), nullable=False, unique=True),
        sa.Column("reservation_id", sa.BigInteger, sa.ForeignKey("reservations.id"), nullable=False, unique=True),
        sa.Column("ticket_id", sa.BigInteger, sa.ForeignKey("tickets.id"), nullable=False, unique=True),
        sa.Column("amount", sa.Numeric(19, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("transaction_id", sa.String(255), nullable=True),
        sa.Column("payment_details", JSONB, nullable=True),
        sa.Column("failure_reason", sa.Text, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_index("idx_events_status", "events", ["status"])
    op.create_index("idx_events_start_date", "events", ["start_date_time"])
    op.create_index("idx_tickets_event_status", "tickets", ["event_id", "status"])
    op.create_index("idx_reservations_token", "reservations", ["reservation_token"])
    op.create_index("idx_reservations_status_expires", "reservations", ["status", "expires_at"])
    op.create_index("idx_payments_idempotency_key", "payments", ["idempotency_key"])
    op.create_index("idx_payments_reservation_id", "payments", ["reservation_id"])

    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        """
    )
    for table in ("events", "tickets", "reservations", "payments"):
        op.execute(
            f"""
            CREATE TRIGGER update_{table}_updated_at BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            """
        )


def downgrade() -> None:
    for table in ("payments", "reservations", "tickets", "events"):
        op.execute(f"DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table}")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
    op.drop_table("payments")
    op.drop_table("reservations")
    op.drop_table("tickets")
    op.drop_table("events")
