from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from llmeval.server.core.db import get_session

router = APIRouter(tags=["health"])


@router.get("/health")  # liveness: is the process up?
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")  # readiness: can we actually reach the DB?
async def ready(
    session: Annotated[AsyncSession, Depends(get_session)],  # FastAPI calls get_session() for us
) -> JSONResponse:
    try:
        await session.execute(select(1))  # cheapest possible query: SELECT 1
    except (SQLAlchemyError, OSError):
        return JSONResponse(status_code=503, content={"status": "unavailable", "db": "down"})
    return JSONResponse(content={"status": "ok", "db": "up"})
