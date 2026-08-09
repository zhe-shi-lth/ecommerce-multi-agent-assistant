"""线2 订单监控 Agent：负责订单维度的核验（当前为收货地址补全复核）。

与 InventoryMonitorAgent（预测型：可售天数 + 未来事件）互补，本 Agent 是「核验型」监控：
商家在订单详情点「确认地址已补全」时，先由本 Agent 向订单来源（平台）复核地址是否真已补全，
再决定能否流转状态——避免盲目信任人工操作（Java 侧只编排，不持有监控逻辑）。

- 演示态（ORDER_MONITOR_MODE=demo，默认）：随机模拟平台同步复核的通过/拦截，仅用于非生产演练。
  生产部署前请将模式切到 real 并在设置中心「平台对接」填好对应平台凭证。
- 生产态（ORDER_MONITOR_MODE=real）：经 `PlatformAdapter` 调平台开放 API 读取地址完整标记
  （address_complete）；适配器 HTTP 实现为 TODO 桩，未接入时失败闭合（不静默放行）：
  - 淘宝/天猫：taobao.trade.fullinfo.get
  - 抖音电商（抖店）：order.orderDetail
  - 小红书：order.getOrderDetail
"""

import os
import random
from dataclasses import dataclass


@dataclass
class OrderVerifyResult:
    verified: bool
    reason: str


class OrderMonitorAgent:
    """订单维度的核验监控：确认地址是否真已补全。"""

    def _config(self) -> dict:
        """解析复核配置：设置中心 order_monitor 块优先于环境变量，两者皆缺回退 demo。

        每次 verify 实时读取，使设置中心改动（模式/通过率）无需重启即生效。
        """
        # 延迟导入避免循环依赖；settings_store 不依赖本模块。
        om: dict = {}
        try:
            from app.settings_store import get_settings

            om = get_settings().get("order_monitor") or {}
        except Exception:  # noqa: BLE001
            om = {}
        mode = (om.get("mode") or os.getenv("ORDER_MONITOR_MODE") or "demo").strip().lower()
        try:
            rate = float(om.get("success_rate", os.getenv("ORDER_MONITOR_DEMO_SUCCESS_RATE", "0.5")))
        except (TypeError, ValueError):
            rate = 0.5
        return {"mode": mode, "success_rate": rate}

    def verify(self, order: dict) -> OrderVerifyResult:
        """复核订单地址是否真已补全。

        order: 订单上下文（platform / platform_order_id / address_complete 等），生产态用于调平台。
        返回 OrderVerifyResult：verified=True 表示来源确认已补全，可继续流转；否则应拦截。
        """
        cfg = self._config()
        if cfg["mode"] == "real":
            return self._verify_real(order)
        return self._verify_demo(cfg["success_rate"])

    def _verify_demo(self, success_rate: float) -> OrderVerifyResult:
        # 演示态：随机模拟「平台同步复核」结果（通过/拦截），通过率由设置中心 order_monitor.success_rate 控制。
        # 仅用于非生产演练；生产部署前须切到 real 并接入平台开放 API。
        ok = random.random() < success_rate
        if ok:
            return OrderVerifyResult(True, "平台同步确认：买家已补全收货地址")
        return OrderVerifyResult(
            False, "平台同步复核：收货地址仍不完整，请通过平台后台联系买家补全后再确认"
        )

    def _verify_real(self, order: dict) -> OrderVerifyResult:
        """生产态：经 PlatformAdapter 调平台开放 API 读取地址完整标记。

        任何失败（缺平台 / 缺平台单号 / 未配凭证 / API 未接入 / 网络异常）一律**失败闭合**返回
        verified=False + 可读中文原因，由 Java 转 409 弹窗；绝不静默放行。
        """
        platform = (order.get("platform") or "").strip().lower()
        platform_order_id = str(order.get("platform_order_id") or "").strip()
        if not platform:
            return OrderVerifyResult(False, "该订单缺少来源平台，无法向平台复核地址")
        if not platform_order_id:
            return OrderVerifyResult(
                False,
                "该订单没有平台单号（可能来自本地模拟数据源），无法向平台复核；"
                "请将数据源切换为真实平台拉单后再使用生产态复核",
            )
        try:
            from app.platform import get_adapter

            check = get_adapter(platform).get_address_complete(platform_order_id)
        except Exception as e:  # noqa: BLE001
            return OrderVerifyResult(False, f"向平台复核收货地址失败：{e}")
        return OrderVerifyResult(
            check.complete,
            check.reason
            or ("平台确认：买家已补全收货地址" if check.complete else "平台复核：收货地址仍不完整"),
        )
