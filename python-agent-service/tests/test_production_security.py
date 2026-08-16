import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import settings_store
from app.media_store import persist_media
from app.security import rate_limit_middleware, validate_production_secrets


def test_settings_are_encrypted_on_disk_and_masked_in_api_shape(tmp_path, monkeypatch):
    path = tmp_path / "settings.json"
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", path)
    monkeypatch.setattr(settings_store, "_cache", None)
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", "test-encryption-key-that-is-long-enough")

    saved = settings_store.save_settings({"llm": {"api_key": "secret-api-key"}})
    raw = json.loads(path.read_text(encoding="utf-8"))

    assert saved["llm"]["api_key"] == "secret-api-key"
    assert raw["llm"]["api_key"].startswith("enc:v1:")
    assert settings_store.public_settings(saved)["llm"]["api_key"] == "********"


def test_plaintext_settings_are_migrated_on_first_load(tmp_path, monkeypatch):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"llm": {"api_key": "legacy-plaintext"}}), encoding="utf-8")
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", path)
    monkeypatch.setattr(settings_store, "_cache", None)
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", "test-encryption-key-that-is-long-enough")

    assert settings_store.load_settings()["llm"]["api_key"] == "legacy-plaintext"
    assert json.loads(path.read_text(encoding="utf-8"))["llm"]["api_key"].startswith("enc:v1:")


def test_production_rejects_default_secrets(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "dev-jwt-secret-change-me")
    monkeypatch.setenv("SERVICE_API_KEY", "dev-service-key-change-me")
    monkeypatch.delenv("SETTINGS_ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_production_secrets()


def test_media_store_rejects_non_https_and_private_network_sources():
    with pytest.raises(Exception):
        persist_media("http://example.com/picture.png", "image")
    with pytest.raises(Exception):
        persist_media("https://127.0.0.1/picture.png", "image")


def test_media_store_rejects_wrong_data_url_type():
    with pytest.raises(Exception):
        persist_media("data:text/plain;base64,aGVsbG8=", "image")


def test_trusted_service_calls_are_not_rate_limited(monkeypatch):
    monkeypatch.setenv("SERVICE_API_KEY", "trusted-service-key")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1")
    app = FastAPI()
    app.middleware("http")(rate_limit_middleware)

    @app.post("/internal")
    def internal():
        return {"ok": True}

    client = TestClient(app)
    headers = {"X-Service-Key": "trusted-service-key"}
    assert client.post("/internal", headers=headers).status_code == 200
    assert client.post("/internal", headers=headers).status_code == 200
