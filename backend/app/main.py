"""Equivalente ao GlobalExceptionHandler + instrumentation.ts + startup.ts: monta a aplicação
FastAPI, o CORS, os handlers de erro padronizados e as tarefas de fundo (migrações + job de
expiração de reservas)."""
import asyncio
import sys

if sys.platform == "win32":
    # Evita ConnectionDoesNotExistError do asyncpg no Windows (ver mesmo comentário em seed.py).
    # Precisa vir antes de qualquer outro import: o uvicorn cria o event loop assim que começa
    # a rodar, então definir a política depois não teria efeito.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.container import build_container
from app.database import dispose_engine
from app.errors import BusinessError, DuplicatePaymentError, ResourceNotFoundError, ValidationAppError
from app.jobs.expiration import ExpirationJob
from app.logging_config import configure_logging, log
from app.redis_client import close_redis
from app.routers import events, health, internal, payments, reservations

REASON = {400: "Bad Request", 404: "Not Found", 409: "Conflict", 500: "Internal Server Error"}


def _error_body(status: int, message: str, details: dict[str, str] | None = None) -> dict:
    body = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": status,
        "error": REASON.get(status, "Error"),
        "message": message,
    }
    if details:
        body["details"] = details
    return body


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    container = build_container()
    app.state.container = container

    if settings.migrate_on_startup:
        from alembic import command
        from alembic.config import Config

        try:
            cfg = Config("alembic.ini")
            # command.upgrade() é síncrono e o env.py do Alembic abre seu próprio event loop
            # (asyncio.run) para o engine assíncrono — por isso roda em uma thread separada,
            # que não tem loop em execução, em vez de bloquear/colidir com o loop do Uvicorn.
            await asyncio.to_thread(command.upgrade, cfg, "head")
            log.info("Migrações aplicadas com sucesso")
        except Exception as error:  # noqa: BLE001
            log.error("Falha ao aplicar migrações — o PostgreSQL está no ar? (docker compose up)")
            raise error

    job: ExpirationJob | None = None
    if settings.expiration_job_enabled:
        job = ExpirationJob(run=container.reservations.expire_reservations, interval_ms=settings.expiration_interval_ms)
        job.start()
        container.expiration_job = job
        log.info("Job de expiração de reservas ativo (a cada %d ms)", settings.expiration_interval_ms)

    yield

    if job is not None:
        job.stop()
    await close_redis()
    await dispose_engine()


app = FastAPI(title="Ticketing System API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(reservations.router)
app.include_router(payments.router)
app.include_router(health.router)
app.include_router(internal.router)


@app.exception_handler(ResourceNotFoundError)
async def resource_not_found_handler(_: Request, exc: ResourceNotFoundError) -> JSONResponse:
    log.warning("Resource not found: %s", exc)
    return JSONResponse(_error_body(404, str(exc)), status_code=404)


@app.exception_handler(ValidationAppError)
async def validation_error_handler(_: Request, exc: ValidationAppError) -> JSONResponse:
    return JSONResponse(_error_body(400, str(exc), exc.details), status_code=400)


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    details: dict[str, str] = {}
    for err in exc.errors():
        field = ".".join(str(p) for p in err["loc"] if p not in ("body",)) or "body"
        details[field] = err["msg"]
    return JSONResponse(_error_body(400, "Validation failed", details), status_code=400)


@app.exception_handler(BusinessError)
async def business_error_handler(_: Request, exc: BusinessError) -> JSONResponse:
    log.warning("Business error: %s", exc)
    return JSONResponse(_error_body(400, str(exc)), status_code=400)


@app.exception_handler(DuplicatePaymentError)
async def duplicate_payment_handler(_: Request, exc: DuplicatePaymentError) -> JSONResponse:
    log.warning("Duplicate payment: %s", exc)
    return JSONResponse(_error_body(409, str(exc)), status_code=409)


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    log.error("Unexpected error: %s", exc)
    return JSONResponse(_error_body(500, "An unexpected error occurred"), status_code=500)
