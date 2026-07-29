"""Redis-backed response cache with graceful no-op fallback.

If REDIS_URL is not set or Redis is unreachable, all cache operations
silently become no-ops so the app works identically without Redis.

Usage in a router:
    from cache import cache_response, invalidate_user_cache

    @router.get("/overview")
    @cache_response(ttl=300)
    async def get_overview(..., current_user, ...):
        ...

    # After upload/delete, clear that user's cached analytics:
    await invalidate_user_cache(user_id)
"""

import hashlib
import json
import os
import functools
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

_redis: Any = None  # redis.asyncio.Redis instance, or None if unavailable


async def init_cache() -> None:
    """Connect to Redis at startup. Safe to call even if REDIS_URL is absent."""
    global _redis
    url = os.getenv("REDIS_URL", "")
    if not url:
        logger.info("REDIS_URL not set — running without cache.")
        return
    try:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(url, encoding="utf-8", decode_responses=True)
        await _redis.ping()
        logger.info("Redis cache connected: %s", url)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — running without cache.", exc)
        _redis = None


async def close_cache() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


async def _get(key: str) -> Optional[str]:
    if not _redis:
        return None
    try:
        return await _redis.get(key)
    except Exception:
        return None


async def _set(key: str, value: str, ttl: int) -> None:
    if not _redis:
        return
    try:
        await _redis.setex(key, ttl, value)
    except Exception:
        pass


async def _delete_pattern(pattern: str) -> None:
    if not _redis:
        return
    try:
        keys = await _redis.keys(pattern)
        if keys:
            await _redis.delete(*keys)
    except Exception:
        pass


def _cache_key(prefix: str, user_id: int, kwargs: dict) -> str:
    raw = json.dumps(kwargs, sort_keys=True, default=str)
    h   = hashlib.sha1(raw.encode()).hexdigest()[:12]
    return f"finsight:u{user_id}:{prefix}:{h}"


def cache_response(ttl: int = 300, prefix: str = ""):
    """Decorator for async FastAPI route handlers.

    Caches the JSON-serialisable return value in Redis keyed by user_id +
    all Query parameters.  TTL defaults to 5 minutes.

    The decorated function must have `current_user` as a keyword argument
    (standard Depends pattern) so the cache is always per-user.
    """
    def decorator(fn: Callable) -> Callable:
        cache_prefix = prefix or fn.__name__

        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            user_id = current_user.id if current_user else 0

            # Build cache key from query params (skip db/current_user deps)
            skip = {"db", "current_user", "request"}
            params = {k: v for k, v in kwargs.items() if k not in skip}
            key = _cache_key(cache_prefix, user_id, params)

            cached = await _get(key)
            if cached is not None:
                try:
                    return json.loads(cached)
                except Exception:
                    pass  # corrupted entry — recompute

            result = await fn(*args, **kwargs)

            try:
                await _set(key, json.dumps(result, default=str), ttl)
            except Exception:
                pass  # non-serialisable result — skip caching

            return result

        return wrapper
    return decorator


async def invalidate_user_cache(user_id: int) -> None:
    """Delete all cached analytics for a user (call after upload / delete)."""
    await _delete_pattern(f"finsight:u{user_id}:*")
