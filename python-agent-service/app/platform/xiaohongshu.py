"""小红书 开放 API 适配器（脚手架）。

网关：ark.xiaohongshu.com/ark/open_api/v3/common_controller；access_token 即会话令牌。
- 地址复核：order.getOrderDetail
- 拉单：    order.getOrderList

⚠️ `_request` 为待实现桩：拿到真实 App Key / App Secret / access_token 后实现请求与字段映射
（小红书回传为密文电子面单，订单需标记 encrypted=True）即可。未实现时抛中文 `ConfigError`，
失败闭合，不静默放行。
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


class XiaohongshuAdapter(PlatformAdapter):
    name = "xiaohongshu"
    label = "小红书"
    default_endpoint = "https://ark.xiaohongshu.com/ark/open_api/v3/common_controller"

    def _request(self, method: str, params: dict) -> dict:
        raise ConfigError(
            "「小红书」开放 API 尚未接入：请在 app/platform/xiaohongshu.py 的 _request 中"
            "实现请求（order.getOrderList / order.getOrderDetail）后再切换真实模式"
        )

    def _address_complete_real(self, platform_order_id: str) -> AddressCheck:
        self.require_ready()
        # TODO: data = self._request("order.getOrderDetail", {"orderId": platform_order_id})
        #       detail = data["data"]
        #       complete = all(detail.get(k) for k in
        #           ("receiver_name", "receiver_phone", "province", "city", "address_detail"))
        #       return AddressCheck(complete, "平台确认：买家已补全收货地址" if complete
        #           else "平台复核：收货地址仍不完整")
        self._request("order.getOrderDetail", {"orderId": platform_order_id})
        raise ConfigError("小红书地址复核结果解析尚未实现（见 app/platform/xiaohongshu.py TODO）")

    def _paid_real(self, platform_order_id: str) -> PaymentCheck:
        self.require_ready()
        # TODO: data = self._request("order.getOrderDetail", {"orderId": platform_order_id})
        #       detail = data["data"]
        #       paid = bool(detail.get("pay_amount"))
        #       return PaymentCheck(paid, "平台确认：买家已付款" if paid
        #           else "平台复核：订单仍未付款")
        self._request("order.getOrderDetail", {"orderId": platform_order_id})
        raise ConfigError("小红书付款复核结果解析尚未实现（见 app/platform/xiaohongshu.py TODO）")

    def _ship_order_real(
        self, platform_order_id: str, logistics_company: str, waybill_no: str
    ) -> ShipResult:
        self.require_ready()
        # TODO: 调小红书发货 API（如 order.deliver），回传平台发货状态。
        self._request(
            "order.deliver",
            {"orderId": platform_order_id, "expressCompany": logistics_company, "expressNo": waybill_no},
        )
        raise ConfigError("小红书真实发货回写尚未实现（见 app/platform/xiaohongshu.py TODO）")

    def list_orders(self, plans: list[PlanTarget], since_days: int) -> list[PlatformOrder]:
        self.require_ready()
        # TODO: 按 plans 的平台商品映射 + since_days 回看窗口调 order.getOrderList，
        #       把每个 order 映射为 PlatformOrder（platform_order_id=orderId, encrypted=True）。
        self._request("order.getOrderList", {"page_size": 100})
        raise ConfigError("小红书真实拉单尚未实现（见 app/platform/xiaohongshu.py TODO）")

    def _publish_listing_real(self, payload: PublishListingPayload) -> PublishResult:
        self.require_ready()
        # TODO: 将 payload.product_plan / image_plan / video_url 映射为小红书商品/笔记发布字段，
        #       调用小红书发布 API，成功后返回平台商品 ID/笔记 ID 和链接。
        self._request(
            "product.create",
            {
                "outer_product_id": payload.product_id,
                "title": payload.product_plan.get("recommended_title") or payload.product_name,
            },
        )
        raise ConfigError("小红书真实发布尚未实现：请在 app/platform/xiaohongshu.py 的 _request 与 _publish_listing_real 中接入商品发布 API")
