from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from llmeval.server.core.db import engine
from llmeval.server.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # code before `yield` runs on startup
    yield
    # code after `yield` runs on shutdown, like process.on("SIGTERM", () => pool.end())
    await engine.dispose()


app = FastAPI(title="llmeval API", version="0.1.0", lifespan=lifespan)
app.include_router(health.router)
