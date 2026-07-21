import hashlib
import os

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request

from app.api.line1 import router as line1_router
from app.api.line2 import router as line2_router
from app.api.operation_plan import router as operation_plan_router
from app.api.settings import router as settings_router

load_dotenv()

# 与 Java 共用同一密钥：JWT_SECRET 用于校验浏览器下发的 Bearer JWT，
# SERVICE_API_KEY 用于放行 Java<->Python 双向闭环的内部调用（X-Service-Key 头）。
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-change-me")
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "dev-service-key-change-me")

# HS256 要求密钥 >= 256 位；为兼容任意长度的用户密钥，统一用 SHA-256 派生 32 字节密钥。
# 必须与 Java 侧 JwtService 的派生方式一致（sha256(secret)），保证两端可互验令牌。
JWT_KEY = hashlib.sha256(JWT_SECRET.encode()).digest()


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> dict:
    """业务路由统一鉴权：接受服务间密钥或服务下发的 JWT，否则 401。"""
    # 服务间调用（Java 编排 / Python 写回 Java）
    if x_service_key and x_service_key == SERVICE_API_KEY:
        return {"sub": "service", "role": "SERVICE"}
    # 浏览器下发的用户 JWT
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            return jwt.decode(token, JWT_KEY, algorithms=["HS256"])
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="无效或过期的凭证")
    raise HTTPException(status_code=401, detail="未认证")


app = FastAPI(
    title="Ecommerce Agent Service",
    version="0.1.0",
)

# 业务路由统一要求鉴权；/health 在下方单独放开。
_auth = [Depends(get_current_user)]
app.include_router(operation_plan_router, dependencies=_auth)
app.include_router(line1_router, dependencies=_auth)
app.include_router(line2_router, dependencies=_auth)
app.include_router(settings_router, dependencies=_auth)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "service": "ecommerce-agent-service",
        "status": "ok",
    }
