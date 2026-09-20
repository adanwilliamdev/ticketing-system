"""Equivalente a app/api/internal/expire-reservations/route.ts."""
import hmac

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/internal", tags=["internal"])


def _authorized(header: str | None, secret: str) -> bool:
    if secret == "" or header is None:
        return False
    return hmac.compare_digest(f"Bearer {secret}", header)


# Alternativa ao job em processo (EXPIRATION_JOB_ENABLED=false) para hospedagem serverless:
# agende uma chamada periódica com "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET, fica desativado.
async def _handle(request: Request, authorization: str | None):
    container = request.app.state.container
    if not _authorized(authorization, container.config.cron_secret):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    released = await container.reservations.expire_reservations()
    return {"released": released}


@router.get("/expire-reservations")
async def expire_reservations_get(request: Request, authorization: str | None = Header(default=None)):
    return await _handle(request, authorization)


@router.post("/expire-reservations")
async def expire_reservations_post(request: Request, authorization: str | None = Header(default=None)):
    return await _handle(request, authorization)
