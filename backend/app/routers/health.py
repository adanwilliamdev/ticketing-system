"""Equivalente a app/api/actuator/health/route.ts."""
from fastapi import APIRouter, Request, Response
from sqlalchemy import text

from app.database import get_session_factory
from app.redis_client import get_redis
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


async def _check_db() -> bool:
    try:
        async with get_session_factory()() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False


async def _check_redis() -> bool:
    try:
        await get_redis().ping()
        return True
    except Exception:  # noqa: BLE001
        return False


# GET /api/actuator/health — substitui o health do Spring Actuator (usado no healthcheck do Docker)
@router.get("/api/actuator/health", response_model=HealthResponse)
async def health(response: Response) -> HealthResponse:
    db_up, redis_up = await _check_db(), await _check_redis()
    up = db_up and redis_up
    response.status_code = 200 if up else 503
    return HealthResponse(
        status="UP" if up else "DOWN",
        components={"db": "UP" if db_up else "DOWN", "redis": "UP" if redis_up else "DOWN"},
    )
