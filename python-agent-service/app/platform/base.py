"""平台开放 API 适配器抽象层。

把"模拟数据"与"真实平台拉单"统一到一套中立结构上：适配器只负责**翻译平台协议**
（签名、调用、字段映射），产出 `PlatformOrder` / `AddressCheck`；落库与库存/日销联动仍在
Java 同一事务内完成（Java 是唯一数据源）。Python 不碰数据库、不持有业务事实，只持平台凭证。

当前三家（淘宝/抖音/小红书）的 `_request` 为**清晰标注的 TODO 桩**：未实现时一律抛中文
`ConfigError` 指明文件/函数/官方 API 方法，失败闭合、绝不静默放行或回退模拟数据。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.errors import ConfigError


@dataclass
class AddressCheck:
    """地址完整复核结果（平台中立）。"""

    complete: bool
    reason: str


@dataclass
class PlanTarget:
    """Java 传来的「已确认运营计划」，供适配器把平台商品映射回本地 product_id。"""

    platform: str
    product_id: int | None = None
    plan_id: int | None = None
    product_name: str | None = None
    platform_item_id: str | None = None  # 预留：平台商品 ID / outer_id，用于真实 SKU 映射


@dataclass
class PlatformOrder:
    """平台订单的中立结构：字段与 Java orders 表 / OrderCreateRequest 一一对应，

    使「模拟数据」与「真实拉单」走完全相同的落库路径（status 枚举由 Java 侧统一推导）。
    """

    platform: str
    platform_order_id: str  # 平台单号：淘宝 tid / 抖店 order_id / 小红书 orderId
    order_date: str  # YYYY-MM-DD，日销聚合用
    quantity: int
    paid: bool
    address_complete: bool
    manual_review_required: bool
    payment: float
    post_fee: float
    encrypted: bool
    product_id: int | None = None
    plan_id: int | None = None
    platform_item_id: str | None = None
    receiver_name: str | None = None
    receiver_phone: str | None = None
    receiver_province: str | None = None
    receiver_city: str | None = None
    receiver_district: str | None = None
    receiver_detail: str | None = None
    buyer_nick: str | None = None
    logistics_company: str | None = None
    waybill_no: str | None = None


class PlatformAdapter(ABC):
    """某平台开放 API 的适配器基类。"""

    name: str = ""
    label: str = ""
    default_endpoint: str = ""

    def __init__(self, creds: dict[str, Any]) -> None:
        # creds 来自设置中心 platform_api（resolve_platform_credentials），不读 .env。
        self._creds = creds or {}

    @property
    def endpoint(self) -> str:
        return (self._creds.get("endpoint") or "").strip() or self.default_endpoint

    def require_ready(self) -> None:
        """凭证不全 → ConfigError（失败闭合，绝不静默降级回模拟数据）。"""
        if not self._creds.get("enabled"):
            raise ConfigError(
                f"未开启「{self.label}」平台对接：请在设置中心 → 平台对接 打开开关并填写凭证"
            )
        for field_name, cn in (
            ("app_key", "App Key"),
            ("app_secret", "App Secret"),
            ("access_token", "店铺授权令牌"),
        ):
            if not (self._creds.get(field_name) or "").strip():
                raise ConfigError(f"「{self.label}」平台对接缺少{cn}：请在设置中心 → 平台对接填写")

    @abstractmethod
    def get_address_complete(self, platform_order_id: str) -> AddressCheck:
        """读取收件人地址完整标记（address_complete）。

        platform_order_id 是平台单号（非本地 orders.id）；缺平台单号由调用方负责拒绝。
        """
        raise NotImplementedError

    @abstractmethod
    def list_orders(self, plans: list[PlanTarget], since_days: int) -> list[PlatformOrder]:
        """拉取指定计划关联的订单（按 since_days 回看）。"""
        raise NotImplementedError

    def get_order(self, platform_order_id: str) -> PlatformOrder | None:
        raise ConfigError(f"「{self.label}」尚未实现单笔订单详情拉取")
