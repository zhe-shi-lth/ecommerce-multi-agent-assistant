from fastapi import FastAPI

from app.api.operation_plan import router as operation_plan_router

app = FastAPI(
    title="Ecommerce Agent Service",
    version="0.1.0",
)

app.include_router(operation_plan_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "service": "ecommerce-agent-service",
        "status": "ok",
    }
