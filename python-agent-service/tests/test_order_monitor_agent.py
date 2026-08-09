"""OrderMonitorAgent：real 模式失败闭合、demo 行为不变。"""
import pytest

from app.agents.order_monitor_agent import OrderMonitorAgent
from app.settings_store import save_settings


@pytest.fixture
def real_mode(tmp_path, monkeypatch):
    import app.settings_store as ss

    monkeypatch.setattr(ss, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(ss, "_cache", None)
    save_settings(
        {
            "order_monitor": {"mode": "real", "success_rate": 0.5},
            "platform_api": {
                "taobao": {"enabled": True, "app_key": "ak", "app_secret": "as", "access_token": "tok"},
                "douyin": {"enabled": False, "app_key": "", "app_secret": "", "endpoint": "", "shop_id": "", "access_token": ""},
                "xiaohongshu": {"enabled": False, "app_key": "", "app_secret": "", "endpoint": "", "shop_id": "", "access_token": ""},
            },
        }
    )
    yield


def test_real_no_platform_fails_closed(real_mode):
    a = OrderMonitorAgent()
    r = a.verify({"platform_order_id": "123"})
    assert r.verified is False
    assert "缺少来源平台" in r.reason


def test_real_no_platform_order_id_fails_closed(real_mode):
    a = OrderMonitorAgent()
    r = a.verify({"platform": "taobao"})
    assert r.verified is False
    assert "平台单号" in r.reason


def test_real_unconfigured_platform_fails_closed(real_mode):
    a = OrderMonitorAgent()
    r = a.verify({"platform": "weibo", "platform_order_id": "1"})
    assert r.verified is False
    assert "不支持" in r.reason


def test_real_configured_but_adapter_unimplemented_fails_closed(real_mode):
    a = OrderMonitorAgent()
    r = a.verify({"platform": "taobao", "platform_order_id": "123"})
    assert r.verified is False
    assert "尚未接入" in r.reason or "TODO" in r.reason


def test_demo_still_runs():
    a = OrderMonitorAgent()
    # demo 模式不依赖平台，随机通过/拦截；这里只验证返回结构正确、不抛异常。
    r = a.verify({"platform": "taobao", "platform_order_id": "123"})
    assert r.verified in (True, False)
    assert isinstance(r.reason, str)
