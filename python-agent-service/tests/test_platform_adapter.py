"""PlatformAdapter：工厂、凭证就绪校验、TODO 桩失败闭合。"""
import pytest

from app.errors import ConfigError
from app.platform import get_adapter
from app.platform.base import AddressCheck, PlanTarget, PlatformOrder
from app.platform.taobao import TaobaoAdapter


def test_get_adapter_unknown_platform():
    with pytest.raises(ConfigError):
        get_adapter("weibo")


def test_unconfigured_adapter_get_address_complete_falls_back_to_simulator():
    # 默认 taobao 未开启（模拟器模式）：require_ready 仍抛中文 ConfigError
    adapter = get_adapter("taobao")
    with pytest.raises(ConfigError) as exc:
        adapter.require_ready()
    assert "平台对接" in str(exc.value)

    # 但 get_address_complete 模式无关：未配置时返回同构的模拟真相（不抛），充当官方 API 替身。
    check = adapter.get_address_complete("MOCK1700000000000123456")
    assert isinstance(check, AddressCheck)
    # 同一单号结果稳定（模拟器真相是确定性的）
    assert adapter.get_address_complete("MOCK1700000000000123456").complete == check.complete
    # 不同单号按哈希分布，绝不会抛
    assert adapter.get_address_complete("MOCK1700000000000987654").complete in (True, False)


def test_configured_adapter_todo_scaffold_fails_closed():
    # enabled + 凭证齐全，但 _request 是 TODO 桩 → 抛中文 ConfigError（不静默放行/回退）。
    creds = {
        "platform": "taobao",
        "enabled": True,
        "app_key": "ak",
        "app_secret": "as",
        "endpoint": "",
        "shop_id": "shop1",
        "access_token": "tok",
    }
    adapter = TaobaoAdapter(creds)
    with pytest.raises(ConfigError) as exc:
        adapter.get_address_complete("123")
    msg = str(exc.value)
    assert "taobao" in msg
    assert "尚未接入" in msg or "TODO" in msg

    with pytest.raises(ConfigError) as exc2:
        adapter.list_orders([PlanTarget(platform="taobao", product_id=1)], 14)
    assert "尚未接入" in str(exc2.value) or "TODO" in str(exc2.value)


def test_adapter_base_classes_importable():
    assert issubclass(TaobaoAdapter, __import__("app.platform.base", fromlist=["PlatformAdapter"]).PlatformAdapter)
    # 中立结构可构造
    o = PlatformOrder(
        platform="taobao",
        platform_order_id="tid1",
        order_date="2026-01-01",
        quantity=2,
        paid=True,
        address_complete=True,
        manual_review_required=False,
        payment=99.0,
        post_fee=0.0,
        encrypted=False,
    )
    assert o.platform_order_id == "tid1"
    assert isinstance(AddressCheck(complete=True, reason="ok"), AddressCheck)
