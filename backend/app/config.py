"""Equivalente ao application.yml / config.ts. Tudo pode ser sobrescrito por variáveis de ambiente;
os padrões batem com o docker-compose.yml na raiz do projeto."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://ticketing_user:ticketing_pass@localhost:5432/ticketing_db"
    redis_url: str = "redis://localhost:6379"
    # False por padrão: o Postgres do docker-compose.yml (e o handshake do asyncpg no Windows
    # via Docker Desktop) não usam SSL. Ligue via DB_SSL=true ao apontar para um Postgres
    # gerenciado (RDS, Supabase, etc.) que exija SSL.
    db_ssl: bool = False

    db_pool_max: int = 20
    reservation_timeout_minutes: int = 10
    payment_gateway_delay_ms: int = 2000

    expiration_job_enabled: bool = True
    expiration_interval_ms: int = 60_000

    migrate_on_startup: bool = True
    cron_secret: str = ""

    cors_origins: str = "http://localhost:3000"

    log_level: str = "info"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
