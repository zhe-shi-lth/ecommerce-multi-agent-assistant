"""OrderMonitorAgent：模式无关，始终经 PlatformAdapter.get_address_complete 复核。"""
import pytest

from app.agents.order_monitor_agent import OrderMonitorAgent
from app.settings_store import save_settings


@pytest.fixture
def platform_config(tmp_path, monkeypatch):
    """配置平台凭证（仅 taobao 开启且完整），其余平台关闭。"""
    import app.settings_store as ss

    monkeypatch.setattr(ss, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(ss, "_cache", None)
    save_settings(
        {
            "platform_api": {
                "taobao": {"enabled": True, "app_key": "ak", "app_secret": "as", "access_token": "tok"},
                "douyin": {"enabled": False, "app_key": "", "app_secret": "", "endpoint": "", "shop_id": "", "access_token": ""},
                "xiaohongshu": {"enabled": False, "app_key": "", "app_secret": "", "endpoint": "", "shop_id": "", "access_token": ""},
            },
        }
    )
    import app.platform.factory as factory
    monkeypatch.setattr(factory, "_store_credentials", lambda platform: {
        "platform": platform, "enabled": platform == "taobao",
        "app_key": "ak" if platform == "taobao" else "",
        "app_secret": "as" if platform == "taobao" else "",
        "access_token": "tok" if platform == "taobao" else "",
        "endpoint": "", "shop_id": "shop1",
    })
    yield


def test_missing_platform_fails_closed():
    a = OrderMonitorAgent()
    r = a.verify({"platform_order_id": "123"})
    assert r.verified is False
    assert "缺少来源平台" in r.reason


def test_missing_platform_order_id_fails_closed():
    a = OrderMonitorAgent()
    r = a.verify({"platform": "taobao"})
    assert r.verified is False
    assert "平台单号" in r.reason


def test_unconfigured_platform_fails_closed():
    a = OrderMonitorAgent()
    r = a.verify({"platform": "weibo", "platform_order_id": "1"})
    assert r.verified is False
    assert "不支持" in r.reason


def test_configured_but_adapter_unimplemented_fails_closed(platform_config):
    a = OrderMonitorAgent()
    r = a.verify({"platform": "taobao", "platform_order_id": "123"})
    assert r.verified is False
    assert "尚未接入" in r.reason or "TODO" in r.reason


def test_simulator_fallback_returns_stable_truth(platform_config):
    """未配置真实凭证的平台（douyin 关闭）→ 适配器返回稳定的模拟真相，不抛异常。"""
    a = OrderMonitorAgent()
    r = a.verify({"platform": "douyin", "platform_order_id": "MOCK-DY-001"})
    assert r.verified in (True, False)
    assert isinstance(r.reason, str)
    # 稳定：同一单号两次结果一致。
    r2 = a.verify({"platform": "douyin", "platform_order_id": "MOCK-DY-001"})
    assert r.verified == r2.verified


def test_payment_missing_platform_fails_closed():
    a = OrderMonitorAgent()
    r = a.verify_payment({"platform_order_id": "123"})
    assert r.verified is False
    assert "缺少来源平台" in r.reason


def test_payment_missing_platform_order_id_fails_closed():
    a = OrderMonitorAgent()
    r = a.verify_payment({"platform": "taobao"})
    assert r.verified is False
    assert "平台单号" in r.reason


def test_payment_unconfigured_platform_fails_closed():
    a = OrderMonitorAgent()
    r = a.verify_payment({"platform": "weibo", "platform_order_id": "1"})
    assert r.verified is False
    assert "不支持" in r.reason


def test_payment_configured_but_adapter_unimplemented_fails_closed(platform_config):
    a = OrderMonitorAgent()
    r = a.verify_payment({"platform": "taobao", "platform_order_id": "123"})
    assert r.verified is False
    assert "尚未接入" in r.reason or "TODO" in r.reason


def test_payment_simulator_fallback_returns_stable_truth(platform_config):
    """未配置真实凭证的平台（douyin 关闭）→ 适配器返回稳定的付款模拟真相。"""
    a = OrderMonitorAgent()
    r = a.verify_payment({"platform": "douyin", "platform_order_id": "MOCK-DY-001"})
    assert r.verified in (True, False)
    assert isinstance(r.reason, str)
    r2 = a.verify_payment({"platform": "douyin", "platform_order_id": "MOCK-DY-001"})
    assert r.verified == r2.verified


def test_adapter_get_paid_stable_truth():
    """未配置凭证时 get_paid 返回稳定（同单号一致）、可复现的模拟真相。"""
    from app.platform.douyin import DouyinAdapter

    adapter = DouyinAdapter({})
    r1 = adapter.get_paid("MOCK-PAY-001")
    r2 = adapter.get_paid("MOCK-PAY-001")
    assert r1.paid in (True, False)
    assert isinstance(r1.reason, str)
    assert r1.paid == r2.paid
