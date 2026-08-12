from fastapi.testclient import TestClient

from app.main import app
from app import media_store


def test_health_endpoint_returns_service_status():
    client = TestClient(app, headers={"X-Service-Key": "dev-service-key-change-me"})

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "ecommerce-agent-service",
        "status": "ok",
    }


def test_persist_media_reuses_content_hash(tmp_path, monkeypatch):
    monkeypatch.setattr(media_store, "MEDIA_ROOT", tmp_path)
    source = "data:image/png;base64,aGVsbG8="

    first = media_store.persist_media(source, "image")
    second = media_store.persist_media(source, "image")

    assert first == second
    assert len(list((tmp_path / "image").iterdir())) == 1
