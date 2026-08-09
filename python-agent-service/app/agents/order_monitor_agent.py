"""线2 订单监控 Agent：负责订单维度的核验（收货地址补全复核 + 买家付款复核）。

与 InventoryMonitorAgent（预测型：可售天数 + 未来事件）互补，本 Agent 是「核验型」监控：
商家在订单详情点「确认地址已补全 / 确认已付款」时，先由本 Agent 向订单来源（平台）复核该事实
是否真已达成，再决定能否流转状态——避免盲目信任人工操作（Java 侧只编排，不持有监控逻辑）。

地址与付款两类复核属于同一职责，只是分别走 `PlatformAdapter` 的不同方法：
- `verify(order)` 复核地址是否真已补全（走 `get_address_complete`）；
- `verify_payment(order)` 复核买家是否已付款（走 `get_paid`）。

设计目标：**模式无关、不分成 real/模拟两套**，且两类复核对称。
- 复核始终走 `PlatformAdapter.get_*`：已配置真实凭证 → 调官方开放 API；
  未配置（模拟器模式）→ 由适配器返回与平台同构的模拟真相（稳定哈希，约 60% 判定已达成）。
- 这样「模拟器」与「官方 API」共用同一条落库路径：当前用模拟器模拟官方 API 跑通全链路，
  接上真实凭证即直接查官方 API，**零代码改动**。
- 任何失败（缺平台 / 缺平台单号 / 凭证缺失 / 适配器未接入 / 网络异常）一律**失败闭合**
  返回 verified=False + 可读中文原因，由 Java 转 409 弹窗；绝不静默放行。
"""

from dataclasses import dataclass


@dataclass
class OrderVerifyResult:
    verified: bool
    reason: str


class OrderMonitorAgent:
    """订单维度的核验监控：确认地址是否真已补全（模式无关）。"""

    def verify(self, order: dict) -> OrderVerifyResult:
        """复核订单地址是否真已补全。

        始终经 `PlatformAdapter.get_address_complete`（模式无关）：
        - 已配置真实平台凭证 → 调官方开放 API 读取 address_complete；
        - 未配置（模拟器模式）→ 返回同构的模拟真相（稳定、可复现）。
        返回 OrderVerifyResult：verified=True 表示来源确认已补全，可继续流转；否则应拦截。
        """
        platform = (order.get("platform") or "").strip().lower()
        platform_order_id = str(order.get("platform_order_id") or "").strip()
        if not platform:
            return OrderVerifyResult(False, "该订单缺少来源平台，无法向平台复核地址")
        if not platform_order_id:
            return OrderVerifyResult(
                False,
                "该订单没有平台单号（可能来自本地模拟数据源），无法向平台复核；"
                "请将数据源切换为真实平台拉单后再使用复核",
            )
        try:
            from app.platform import get_adapter

            check = get_adapter(platform).get_address_complete(platform_order_id)
        except Exception as e:  # noqa: BLE001
            # 失败闭合：查不到就当未补全，绝不静默放行（Java 侧不改状态、弹窗提示）。
            return OrderVerifyResult(False, f"向平台复核收货地址失败：{e}")
        return OrderVerifyResult(
            check.complete,
            check.reason
            or ("平台确认：买家已补全收货地址" if check.complete else "平台复核：收货地址仍不完整"),
        )

    def verify_payment(self, order: dict) -> OrderVerifyResult:
        """复核订单是否已付款（模式无关，与 verify 同构）。

        始终经 `PlatformAdapter.get_paid`：已配置真实平台凭证 → 调官方开放 API 读取 paid；
        未配置（模拟器模式）→ 返回同构的模拟真相（稳定、可复现）。
        返回 OrderVerifyResult：verified=True 表示来源确认已付款，可继续流转；否则应拦截。
        """
        platform = (order.get("platform") or "").strip().lower()
        platform_order_id = str(order.get("platform_order_id") or "").strip()
        if not platform:
            return OrderVerifyResult(False, "该订单缺少来源平台，无法向平台复核付款")
        if not platform_order_id:
            return OrderVerifyResult(
                False,
                "该订单没有平台单号（可能来自本地模拟数据源），无法向平台复核；"
                "请将数据源切换为真实平台拉单后再使用复核",
            )
        try:
            from app.platform import get_adapter

            check = get_adapter(platform).get_paid(platform_order_id)
        except Exception as e:  # noqa: BLE001
            # 失败闭合：查不到就当未付款，绝不静默放行（Java 侧不改状态、弹窗提示）。
            return OrderVerifyResult(False, f"向平台复核付款失败：{e}")
        return OrderVerifyResult(
            check.paid,
            check.reason
            or ("平台确认：买家已付款" if check.paid else "平台复核：订单仍未付款"),
        )
