from __future__ import annotations

import hashlib
import os
import threading
import time
from contextvars import ContextVar
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()
_last_cleanup = 0.0
tenant_context: ContextVar[tuple[int, int] | None] = ContextVar("tenant_context", default=None)

async def tenant_context_middleware(request: Request, call_next):
    company_id = request.headers.get("x-company-id")
    store_id = request.headers.get("x-store-id")
    token = tenant_context.set((int(company_id), int(store_id)) if company_id and store_id else None)
    try:
        return await call_next(request)
    finally:
        tenant_context.reset(token)


def validate_production_secrets() -> None:
    if os.getenv("APP_ENV", "development").lower() not in {"prod", "production"}:
        return
    checks = {
        "JWT_SECRET": os.getenv("JWT_SECRET", ""),
        "SERVICE_API_KEY": os.getenv("SERVICE_API_KEY", ""),
        "SETTINGS_ENCRYPTION_KEY": os.getenv("SETTINGS_ENCRYPTION_KEY", ""),
    }
    invalid = [name for name, value in checks.items() if not value or value.startswith("dev-") or len(value) < 32]
    if invalid:
        raise RuntimeError("Production secrets are not securely configured: " + ", ".join(invalid))


async def rate_limit_middleware(request: Request, call_next):
    global _last_cleanup
    if request.method in {"GET", "HEAD", "OPTIONS"} or request.url.path == "/health":
        return await call_next(request)
    service_key = request.headers.get("x-service-key")
    if service_key and service_key == os.getenv("SERVICE_API_KEY", "dev-service-key-change-me"):
        return await call_next(request)

    limit = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    identity = (
        request.headers.get("authorization")
        or request.headers.get("x-service-key")
        or (request.client.host if request.client else "unknown")
    )
    key = hashlib.sha256(f"{identity}:{request.url.path}".encode()).hexdigest()
    now = time.monotonic()
    with _lock:
        if now - _last_cleanup > 60:
            expired = [entry for entry, values in _hits.items() if not values or values[-1] < now - 60]
            for entry in expired:
                _hits.pop(entry, None)
            _last_cleanup = now

        requests = _hits[key]
        while requests and requests[0] < now - 60:
            requests.popleft()
        if len(requests) >= limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "操作过于频繁，请稍后重试"},
                headers={"Retry-After": "60"},
            )
        requests.append(now)
    return await call_next(request)
