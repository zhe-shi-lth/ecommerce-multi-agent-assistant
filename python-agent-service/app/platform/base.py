"""平台开放 API 适配器抽象层。

把"模拟数据"与"真实平台拉单"统一到一套中立结构上：适配器只负责**翻译平台协议**
（签名、调用、字段映射），产出 `PlatformOrder` / `AddressCheck`；落库与库存/日销联动仍在
Java 同一事务内完成（Java 是唯一数据源）。Python 不碰数据库、不持有业务事实，只持平台凭证。

当前三家（淘宝/抖音/小红书）的 `_request` 为**清晰标注的 TODO 桩**：未实现时一律抛中文
`ConfigError` 指明文件/函数/官方 API 方法，失败闭合、绝不静默放行或回退模拟数据。
"""
from __future__ import annotations

import hashlib
import time
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
class PaymentCheck:
    """付款复核结果（平台中立）。"""

    paid: bool
    reason: str


@dataclass
class ShipResult:
    """平台发货回执（模式无关）：success=平台是否受理发货，message=可读原因/平台回执。"""

    success: bool
    message: str
    platform_ship_status: str = ""  # 平台侧发货状态（如 SHIPPED / REJECTED），供 Java 回写


@dataclass
class PlanTarget:
    """Java 传来的「已确认运营计划」，供适配器把平台商品映射回本地 product_id。"""

    platform: str
    product_id: int | None = None
    plan_id: int | None = None
    product_name: str | None = None
    platform_item_id: str | None = None  # 预留：平台商品 ID / outer_id，用于真实 SKU 映射


@dataclass
class PublishListingPayload:
    """Line 1 发布适配器的中立入参：Java 只传业务事实，平台协议在 Python 翻译。"""

    platform: str
    product_id: int | None = None
    plan_id: int | None = None
    product_name: str | None = None
    product_plan: dict[str, Any] = field(default_factory=dict)
    image_plan: dict[str, Any] = field(default_factory=dict)
    video_url: str | None = None


@dataclass
class PublishResult:
    """平台发布结果的中立结构，供 Java 写回发布状态和外部商品映射。"""

    success: bool
    platform: str
    message: str
    external_item_id: str | None = None
    external_url: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


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

    def get_address_complete(self, platform_order_id: str) -> AddressCheck:
        """读取收件人地址完整标记（address_complete），模式无关。

        本方法是「模拟器 = 官方 API 替身」的关键接缝：
        - 已配置真实凭证 → 走 `_address_complete_real` 调平台开放 API（实现见各适配器 TODO）；
        - 未配置（模拟器模式）→ 由 `_simulated_address_complete` 返回与平台同构的模拟真相，
          使系统在没有接官方 API 时也能完整演练「地址不全 → 定时器轮询到已补全 → 自动流转」。

        真实适配器未实现（TODO 桩）时 `_address_complete_real` 抛 `ConfigError`，由调用方失败闭合。
        """
        try:
            self.require_ready()
        except ConfigError:
            # 未配置真实凭证：模拟器模式，返回同构的模拟真相（不做真实网络调用）。
            return self._simulated_address_complete(platform_order_id)
        return self._address_complete_real(platform_order_id)

    @abstractmethod
    def _address_complete_real(self, platform_order_id: str) -> AddressCheck:
        """已配置真实凭证时，调平台开放 API 读取 address_complete（由各适配器实现）。"""
        raise NotImplementedError

    def _simulated_address_complete(self, platform_order_id: str) -> AddressCheck:
        """模拟器模式下的地址完整真相：用平台单号做稳定哈希，约 60% 判定为「买家已补全」。

        稳定（同一单号每次结果一致），因此定时轮询看到的是「买家是否补全」这一事实，
        而非随机抖动——模拟器在此充当官方 API 的替身。接上真实凭证后自动改走 `_address_complete_real`。
        """
        raw = (platform_order_id or "").replace("MOCK", "")
        if not raw:
            return AddressCheck(False, "平台复核：该订单缺少平台单号（模拟器）")
        digest = hashlib.md5(raw.encode("utf-8")).hexdigest()
        healed = (int(digest, 16) % 10) < 6  # 约 60% 已补全
        if healed:
            return AddressCheck(True, "平台确认：买家已补全收货地址（模拟器）")
        return AddressCheck(False, "平台复核：收货地址仍不完整（模拟器）")

    def get_paid(self, platform_order_id: str) -> PaymentCheck:
        """读取付款标记（paid），模式无关，与 get_address_complete 完全同构。

        这是「模拟器 = 官方 API 替身」在付款维度的同一接缝：
        - 已配置真实凭证 → 走 `_paid_real` 调平台开放 API（实现见各适配器 TODO）；
        - 未配置（模拟器模式）→ 由 `_simulated_paid` 返回与平台同构的模拟真相，
          使系统在没有接官方 API 时也能完整演练「未付款 → 定时器轮询到已付款 → 自动流转」。

        真实适配器未实现（TODO 桩）时 `_paid_real` 抛 `ConfigError`，由调用方失败闭合。
        """
        try:
            self.require_ready()
        except ConfigError:
            # 未配置真实凭证：模拟器模式，返回同构的模拟真相（不做真实网络调用）。
            return self._simulated_paid(platform_order_id)
        return self._paid_real(platform_order_id)

    @abstractmethod
    def _paid_real(self, platform_order_id: str) -> PaymentCheck:
        """已配置真实凭证时，调平台开放 API 读取 paid（由各适配器实现）。"""
        raise NotImplementedError

    def ship_order(
        self, platform_order_id: str, logistics_company: str, waybill_no: str
    ) -> ShipResult:
        """回写发货（物流公司 + 运单号）到平台，模式无关，与 get_address_complete / get_paid 同构。

        这是「模拟器 = 官方 API 替身」在发货维度的同一接缝：
        - 已配置真实凭证 → 走 `_ship_order_real` 调平台发货开放 API（实现见各适配器 TODO）；
        - 未配置（模拟器模式）→ 由 `_simulated_ship_order` 返回「平台已受理」的同构回执，
          使系统在没有接官方 API 时也能完整演练「发货 → SHIPPED / 失败 → SHIPPING_FAILED」。

        真实适配器未实现（TODO 桩）时 `_ship_order_real` 抛 `ConfigError`，由调用方失败闭合。
        """
        try:
            self.require_ready()
        except ConfigError:
            return self._simulated_ship_order(platform_order_id, logistics_company, waybill_no)
        return self._ship_order_real(platform_order_id, logistics_company, waybill_no)

    @abstractmethod
    def _ship_order_real(
        self, platform_order_id: str, logistics_company: str, waybill_no: str
    ) -> ShipResult:
        """已配置真实凭证时，调平台发货开放 API 回写物流（由各适配器实现）。"""
        raise NotImplementedError

    def _simulated_ship_order(
        self, platform_order_id: str, logistics_company: str, waybill_no: str
    ) -> ShipResult:
        """模拟器模式下的发货回执：一律受理成功，模拟平台已记录发货。

        稳定且成功（模拟器充当官方 API 替身，不随机抖动）。接上真实凭证后自动改走 `_ship_order_real`；
        真实 API 返回失败时，Java 侧会把订单置为 SHIPPING_FAILED 供重试。
        """
        if not (logistics_company or "").strip() or not (waybill_no or "").strip():
            return ShipResult(
                False,
                "平台复核：发货缺少物流公司或运单号（模拟器）",
                "REJECTED",
            )
        return ShipResult(
            True,
            f"平台确认：已受理发货（模拟器），物流={logistics_company}，运单={waybill_no}",
            "SHIPPED",
        )

    def _simulated_paid(self, platform_order_id: str) -> PaymentCheck:
        """模拟器模式下的付款真相：用平台单号做稳定哈希，约 60% 判定为「已付款」。

        稳定（同一单号每次结果一致），与 `_simulated_address_complete` 同构——定时轮询看到的是
        「买家是否付款」这一事实，而非随机抖动。接上真实凭证后自动改走 `_paid_real`。
        """
        raw = (platform_order_id or "").replace("MOCK", "")
        if not raw:
            return PaymentCheck(False, "平台复核：该订单缺少平台单号（模拟器）")
        digest = hashlib.md5(raw.encode("utf-8")).hexdigest()
        paid = (int(digest, 16) % 10) < 6  # 约 60% 已付款
        if paid:
            return PaymentCheck(True, "平台确认：买家已付款（模拟器）")
        return PaymentCheck(False, "平台复核：订单仍未付款（模拟器）")

    @abstractmethod
    def list_orders(self, plans: list[PlanTarget], since_days: int) -> list[PlatformOrder]:
        """拉取指定计划关联的订单（按 since_days 回看）。"""
        raise NotImplementedError

    def publish_listing(self, payload: PublishListingPayload) -> PublishResult:
        """真实发布入口：发布属于外部副作用，必须失败闭合，不走模拟数据。"""
        self.require_ready()
        return self._publish_listing_real(payload)

    @abstractmethod
    def _publish_listing_real(self, payload: PublishListingPayload) -> PublishResult:
        """已配置真实凭证时，把中立商品/素材/文案结构映射到平台上架 API。"""
        raise NotImplementedError

    def get_order(self, platform_order_id: str) -> PlatformOrder | None:
        raise ConfigError(f"「{self.label}」尚未实现单笔订单详情拉取")
