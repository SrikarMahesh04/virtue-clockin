from collections.abc import Generator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import settings


@lru_cache
def engine() -> Engine:
    url = settings().database_url
    if not url:
        raise HTTPException(503, "CONFIGURATION_REQUIRED: DATABASE_URL is not configured")
    if not url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise ValueError("Runtime DATABASE_URL must use PostgreSQL")
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url, pool_pre_ping=True)


def get_db() -> Generator[Session, None, None]:
    with Session(engine()) as db:
        yield db
