"""测试默认关闭真实 LLM，走规则路径，保证不依赖 Ollama 也能全绿。"""
import os

os.environ["LLM_ENABLED"] = "false"

import pytest


@pytest.fixture(autouse=True)
def _isolate_settings(monkeypatch, tmp_path):
    """隔离真实 settings.json：测试统一用默认（全开）配置，避免被本地关闭的开关
    （如 image_review_enabled=false）污染，导致图片审核等断言失败。"""
    import app.settings_store as settings_store

    fake = tmp_path / "settings.json"
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", fake)
    monkeypatch.setattr(settings_store, "_cache", None)
