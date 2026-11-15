from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from llmeval.server.core.config import settings

# Engine = the connection pool (like `new Pool()` in pg). Create once, reuse everywhere.
engine = create_async_engine(
    str(settings.database_url),
    pool_size=settings.db_pool_size,  # from env, never hardcoded
    pool_pre_ping=True,               # check a connection is alive before using it
)

# Session factory. A session = one unit of work (queries + commit/rollback).
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Gives each request its own session and closes it afterwards.

    Express equivalent: a middleware that does `req.db = await pool.connect()`,
    calls next(), then releases the connection when the response is done.
    """
    async with SessionLocal() as session:
        yield session  # the route runs here; cleanup happens after
