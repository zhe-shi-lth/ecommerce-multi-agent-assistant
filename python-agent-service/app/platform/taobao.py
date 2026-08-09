"""淘宝/天猫 开放 API 适配器（脚手架）。

公共参数：method / app_key / session(access_token) / timestamp / format=json / v=2.0 /
sign_method=hmac-sha256 / sign。
- 地址复核：taobao.trade.fullinfo.get
- 拉单：    taobao.trades.sold.get（start_created / end_created / page_no / page_size）

⚠️ `_request` 为待实现桩：拿到真实 App Key / App Secret / access_token 后，按上方官方
API 实现签名与请求、并把返回字段映射为 `PlatformOrder` / `AddressCheck` 即可。未实现时
抛中文 `ConfigError`，失败闭合，不静默放行。
"""
from __future__ import annotations

from app.errors import ConfigError
from app.platform.base import (
    AddressCheck,
    PaymentCheck,
    PlanTarget,
    PlatformAdapter,
    PlatformOrder,
    PublishListingPayload,
    PublishResult,
    ShipResult,
)

_ADDR_FIELDS = (
    "tid,status,payment,post_fee,receiver_name,receiver_phone,"
    "receiver_state,receiver_city,receiver_district,receiver_address"
)


class TaobaoAdapter(PlatformAdapter):
    name = "taobao"
    label = "淘宝/天猫"
    default_endpoint = "https://eco.taobao.com/router/rest"

    # --- 需接入平台开放 API（脚手架）------------------------------------------
    def _request(self, method: str, params: dict) -> dict:
        raise ConfigError(
            "「淘宝/天猫」开放 API 尚未接入：请在 app/platform/taobao.py 的 _request 中"
            "实现签名与请求（taobao.trade.fullinfo.get / taobao.trades.sold.get）后再切换真实模式"
        )

    def _address_complete_real(self, platform_order_id: str) -> AddressCheck:
        self.require_ready()
        # TODO: data = self._request("taobao.trade.fullinfo.get",
        #        {"tid": platform_order_id, "fields": _ADDR_FIELDS})
        #       trade = data["trade_fullinfo_get_response"]["trade"]
        #       complete = all(trade.get(k) for k in
        #           ("receiver_name", "receiver_phone", "receiver_state", "receiver_city", "receiver_address"))
        #       return AddressCheck(complete, "平台确认：买家已补全收货地址" if complete
        #           else "平台复核：收货地址仍不完整")
        self._request("taobao.trade.fullinfo.get", {"tid": platform_order_id, "fields": _ADDR_FIELDS})
        raise ConfigError("淘宝地址复核结果解析尚未实现（见 app/platform/taobao.py TODO）")

    def _paid_real(self, platform_order_id: str) -> PaymentCheck:
        self.require_ready()
        # TODO: data = self._request("taobao.trade.fullinfo.get",
        #        {"tid": platform_order_id, "fields": "tid,status,payment"})
        #       trade = data["trade_fullinfo_get_response"]["trade"]
        #       paid = trade.get("status") in ("TRADE_BUYER_PAY", "TRADE_PAID")
        #       return PaymentCheck(paid, "平台确认：买家已付款" if paid
        #           else "平台复核：订单仍未付款")
        self._request("taobao.trade.fullinfo.get", {"tid": platform_order_id, "fields": "tid,status,payment"})
        raise ConfigError("淘宝付款复核结果解析尚未实现（见 app/platform/taobao.py TODO）")

    def _ship_order_real(
        self, platform_order_id: str, logistics_company: str, waybill_no: str
    ) -> ShipResult:
        self.require_ready()
        # TODO: 调淘宝物流发货 API（如 taobao.logistics.offline.send），回传平台发货状态。
        self._request(
            "taobao.logistics.offline.send",
            {"tid": platform_order_id, "company_code": logistics_company, "out_sid": waybill_no},
        )
        raise ConfigError("淘宝真实发货回写尚未实现（见 app/platform/taobao.py TODO）")

    def list_orders(self, plans: list[PlanTarget], since_days: int) -> list[PlatformOrder]:
        self.require_ready()
        # TODO: 按 plans 的平台商品映射 + since_days 回看窗口调 taobao.trades.sold.get，
        #       把每个 trade 映射为 PlatformOrder（platform_order_id=tid）。
        self._request("taobao.trades.sold.get", {"page_size": 100})
        raise ConfigError("淘宝真实拉单尚未实现（见 app/platform/taobao.py TODO）")

    def _publish_listing_real(self, payload: PublishListingPayload) -> PublishResult:
        self.require_ready()
        # TODO: 将 payload.product_plan / image_plan / video_url 映射为淘宝商品发布字段，
        #       调用淘宝商品发布/编辑 API，成功后返回平台商品 ID 和商品链接。
        self._request(
            "taobao.item.add",
            {
                "outer_id": payload.product_id,
                "title": payload.product_plan.get("recommended_title") or payload.product_name,
            },
        )
        raise ConfigError("淘宝真实发布尚未实现：请在 app/platform/taobao.py 的 _request 与 _publish_listing_real 中接入商品发布 API")
