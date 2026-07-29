"""Database setup — SQLite with async support."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL, RAM_ONLY_MODE, IS_POSTGRES

# SQLite needs check_same_thread=False; Postgres does not accept it
_connect_args = {} if IS_POSTGRES else {"check_same_thread": False}

_pool_kwargs = {"pool_size": 5, "max_overflow": 10} if IS_POSTGRES else {}

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
    **_pool_kwargs,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
