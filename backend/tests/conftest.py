"""Shared fixtures for all test modules."""

import asyncio
import os
import pytest

os.environ["FINSIGHT_RAM_ONLY"] = "true"

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from main import app
from database import Base, get_db
from models import User
from auth import hash_password, create_access_token, get_current_user


# ── Per-test isolated database ────────────────────────────────────────────────

@pytest.fixture(scope="function")
def client(tmp_path):
    db_path = tmp_path / "test.db"
    db_url  = f"sqlite+aiosqlite:///{db_path}"
    async_engine = create_async_engine(db_url, echo=False)

    loop = asyncio.new_event_loop()
    loop.run_until_complete(_create_tables(async_engine))

    TestSessionLocal = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with TestSessionLocal() as session:
            yield session

    # Create a test user and wire get_current_user to always return it
    test_user = User(
        id=1,
        username="testuser",
        hashed_password=hash_password("testpass"),
        display_name="Test User",
    )

    async def _seed_user():
        async with TestSessionLocal() as session:
            session.add(User(
                username="testuser",
                hashed_password=hash_password("testpass"),
                display_name="Test User",
            ))
            await session.commit()

    loop.run_until_complete(_seed_user())

    async def override_get_current_user():
        async with TestSessionLocal() as session:
            from sqlalchemy import select
            result = await session.execute(select(User).where(User.username == "testuser"))
            return result.scalar_one()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    token = create_access_token(1, "testuser")

    with TestClient(app, raise_server_exceptions=False) as c:
        c.headers.update({"Authorization": f"Bearer {token}"})
        yield c

    app.dependency_overrides.clear()
    loop.run_until_complete(async_engine.dispose())
    loop.close()


async def _create_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
