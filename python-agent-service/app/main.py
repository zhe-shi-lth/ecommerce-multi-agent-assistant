from fastapi import FastAPI

app = FastAPI(
    title="Ecommerce Agent Service",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "service": "ecommerce-agent-service",
        "status": "ok",
    }
