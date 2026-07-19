from fastapi import FastAPI

from app.api.operation_plan import router as operation_plan_router
from app.api.line1 import router as line1_router
from app.api.line2 import router as line2_router
from app.api.settings import router as settings_router

app = FastAPI(
    title="Ecommerce Agent Service",
    version="0.1.0",
)

app.include_router(operation_plan_router)
app.include_router(line1_router)
app.include_router(line2_router)
app.include_router(settings_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "service": "ecommerce-agent-service",
        "status": "ok",
    }
