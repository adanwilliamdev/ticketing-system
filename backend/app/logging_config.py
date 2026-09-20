"""Logger mínimo, equivalente ao logger.ts. Defina LOG_LEVEL=silent para desligar (usado nos testes)."""
import logging
import sys

from app.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    level = logging.CRITICAL + 1 if settings.log_level == "silent" else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s.%(msecs)03dZ %(levelname)s - %(name)s - %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )


log = logging.getLogger("ticketing")
