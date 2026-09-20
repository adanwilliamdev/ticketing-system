"""Composição das dependências — equivalente a container.ts. Criado uma única vez por processo,
na inicialização (lifespan) da aplicação FastAPI, e guardado em `app.state`."""
import uuid
from dataclasses import dataclass

from app.config import Settings, get_settings
from app.database import get_session_factory
from app.jobs.expiration import ExpirationJob
from app.lock import RedisLockManager
from app.payment_gateway import SimulatedGateway
from app.redis_client import get_redis
from app.services.catalog_service import CatalogService
from app.services.payment_service import PaymentService
from app.services.reservation_service import ReservationService


@dataclass
class Container:
    config: Settings
    locks: RedisLockManager
    catalog: CatalogService
    reservations: ReservationService
    payments: PaymentService
    expiration_job: ExpirationJob | None = None


def build_container() -> Container:
    config = get_settings()
    session_factory = get_session_factory()
    redis = get_redis()
    locks = RedisLockManager(redis)

    reservations = ReservationService(
        session_factory=session_factory,
        locks=locks,
        reservation_timeout_minutes=config.reservation_timeout_minutes,
    )
    payments = PaymentService(
        session_factory=session_factory,
        reservations=reservations,
        locks=locks,
        gateway=SimulatedGateway(config.payment_gateway_delay_ms),
        generate_id=lambda: str(uuid.uuid4()),
    )
    catalog = CatalogService(session_factory=session_factory)

    return Container(config=config, locks=locks, catalog=catalog, reservations=reservations, payments=payments)
