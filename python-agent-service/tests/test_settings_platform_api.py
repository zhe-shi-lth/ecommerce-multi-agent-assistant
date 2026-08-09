"""platform_api 设置块：默认形状、规整、校验、不读 .env。"""
import os

from app.settings_store import (
    DEFAULT_SETTINGS,
    PLATFORM_KEYS,
    _normalize,
    load_settings,
    resolve_platform_credentials,
    save_settings,
)
from app.api import settings as sapi


def test_default_shape():
    pa = DEFAULT_SETTINGS["platform_api"]
    assert set(pa.keys()) == set(PLATFORM_KEYS)
    for p in PLATFORM_KEYS:
        block = pa[p]
        assert block == {
            "enabled": False,
            "app_key": "",
            "app_secret": "",
            "endpoint": "",
            "shop_id": "",
            "access_token": "",
        }


def test_normalize_rebuilds_every_platform_and_backfills():
    # 部分补丁：仅 taobao.enabled=true，其余平台与字段应保持默认（修复 _deep_merge 只两层的问题）。
    data = _normalize({"platform_api": {"taobao": {"enabled": True}}})
    pa = data["platform_api"]
    assert pa["taobao"]["enabled"] is True
    assert pa["taobao"]["app_key"] == ""  # 缺字段补默认
    for p in ("douyin", "xiaohongshu"):
        assert pa[p]["enabled"] is False
        assert pa[p]["app_key"] == ""


def test_normalize_drops_unknown_platform():
    data = _normalize({"platform_api": {"taobao": {"enabled": True}, "weibo": {"app_key": "x"}}})
    assert "weibo" not in data["platform_api"]
    assert "taobao" in data["platform_api"]


def test_validate_rejects_unknown_platform():
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        sapi._validate({"platform_api": {"weibo": {"enabled": True}}})
    assert exc.value.status_code == 400


def test_validate_rejects_enabled_without_app_key():
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        sapi._validate(
            {"platform_api": {"taobao": {"enabled": True, "app_secret": "as", "access_token": "tok"}}}
        )
    assert exc.value.status_code == 400


def test_validate_accepts_configured_platform():
    out = sapi._validate(
        {"platform_api": {"taobao": {"enabled": True, "app_key": "ak", "app_secret": "as", "access_token": "tok"}}}
    )
    assert out["platform_api"]["taobao"]["enabled"] is True
    assert out["platform_api"]["taobao"]["app_key"] == "ak"


def test_round_trip_via_save_load(tmp_path, monkeypatch):
    import app.settings_store as ss

    monkeypatch.setattr(ss, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(ss, "_cache", None)
    save_settings(
        {"platform_api": {"taobao": {"enabled": True, "app_key": "ak", "app_secret": "as", "access_token": "tok"}}}
    )
    loaded = load_settings()
    assert loaded["platform_api"]["taobao"]["enabled"] is True
    assert loaded["platform_api"]["taobao"]["app_key"] == "ak"
    # 兄弟平台保持默认
    assert loaded["platform_api"]["douyin"]["enabled"] is False


def test_resolve_does_not_read_env(monkeypatch):
    # platform_api 没有对应环境变量；即使设置了同名 env，也应被忽略，只取设置中心。
    monkeypatch.setenv("TAOBAO_APP_KEY", "should-not-be-used")
    creds = resolve_platform_credentials("taobao")
    assert creds["app_key"] == ""  # 默认空，未读 env
    assert creds["platform"] == "taobao"
