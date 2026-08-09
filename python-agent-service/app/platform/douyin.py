"""抖音电商（抖店）开放 API 适配器（脚手架）。

签名：md5(app_key + param_json + timestamp + v + app_secret)；access_token 即会话令牌。
- 地址复核：order.orderDetail
- 拉单：    order.searchList

⚠️ `_request` 为待实现桩：拿到真实 App Key / App Secret / access_token 后实现签名与请求、
并把返回字段映射为 `PlatformOrder` / `AddressCheck` 即可。未实现时抛中文 `ConfigError`，
失败闭合，不静默放行。抖店回传为密文电子面单，订单需标记 encrypted=True。
"""
from __future__ import annotations

from app.errors import ConfigError
from app.platform.base import AddressCheck, PlanTarget, PlatformAdapter, PlatformOrder


class DouyinAdapter(PlatformAdapter):
    name = "douyin"
    label = "抖音（抖店）"
    default_endpoint = "https://openapi-fxg.jinritemai.com"

    def _request(self, method: str, params: dict) -> dict:
        raise ConfigError(
            "「抖音（抖店）」开放 API 尚未接入：请在 app/platform/douyin.py 的 _request 中"
            "实现签名与请求（order.searchList / order.orderDetail）后再切换真实模式"
        )

    def get_address_complete(self, platform_order_id: str) -> AddressCheck:
        self.require_ready()
        # TODO: data = self._request("order.orderDetail", {"order_id": platform_order_id})
        #       detail = data["data"]
        #       complete = all(detail.get(k) for k in
        #           ("encrypt_detail_address", "encrypt_receiver", "province", "city", "town"))
        #       return AddressCheck(complete, "平台确认：买家已补全收货地址" if complete
        #           else "平台复核：收货地址仍不完整")
        self._request("order.orderDetail", {"order_id": platform_order_id})
        raise ConfigError("抖音地址复核结果解析尚未实现（见 app/platform/douyin.py TODO）")

    def list_orders(self, plans: list[PlanTarget], since_days: int) -> list[PlatformOrder]:
        self.require_ready()
        # TODO: 按 plans 的平台商品映射 + since_days 回看窗口调 order.searchList，
        #       把每个 order 映射为 PlatformOrder（platform_order_id=order_id, encrypted=True）。
        self._request("order.searchList", {"page_size": 100})
        raise ConfigError("抖音真实拉单尚未实现（见 app/platform/douyin.py TODO）")
