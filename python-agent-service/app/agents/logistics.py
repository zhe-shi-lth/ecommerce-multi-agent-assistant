"""订单履约的确定性物流风险与异常处理（步骤 5）。

设计原则：
- 不依赖外部物流 API、不引网络调用，纯基于订单与库存上下文的启发式推算，
  保证规则路径与 LLM 提示词共用同一套权威结论。
- 复用步骤 4「确定性内核 + 接线」模式：本模块是「脑」，由 OrderFulfillmentAgent 接线。
- 售后仅在计划内字段表达（after_sale_suggested / after_sale_reason），不新增数据库表。
"""
from dataclasses import dataclass

from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext

# 大额订单阈值：达到则建议分批发货，物流风险升为 MEDIUM。
LARGE_ORDER_QTY = 10


@dataclass
class LogisticsRiskResult:
    logistics_risk_level: str  # LOW / MEDIUM / HIGH
    anomaly_details: list[str]
    suggested_actions: list[str]
    after_sale_suggested: bool
    after_sale_reason: str


def compute_logistics_risk(order: OrderContext, inventory: InventoryContext) -> LogisticsRiskResult:
    """基于订单与库存上下文，确定性地推算物流风险、异常明细、处理建议与售后建议。"""
    anomalies: list[str] = []
    actions: list[str] = []
    level = "LOW"

    # HIGH 级阻断类异常
    if not order.paid:
        anomalies.append("订单未付款，发货被阻")
        actions.append("催付或拦截发货")
        level = "HIGH"
    if not order.address_complete:
        anomalies.append("收货地址不完整，存在退回风险")
        actions.append("联系客户补全收货地址")
        level = "HIGH"

    available_stock = inventory.current_stock - inventory.reserved_stock
    if available_stock < order.quantity:
        anomalies.append(f"可用库存不足（{available_stock} < 订单量 {order.quantity}）")
        actions.append("优先调拨库存或加急采购")
        level = "HIGH"

    # MEDIUM 级风险（仅在尚未 HIGH 时升级）
    if level != "HIGH":
        if order.quantity >= LARGE_ORDER_QTY:
            anomalies.append(f"订单量较大（{order.quantity}），建议分批发货")
            actions.append("拆分为多批次发货以降低履约风险")
            level = "MEDIUM"
        elif available_stock < order.quantity * 2:
            anomalies.append("可用库存偏紧，可能延迟发货")
            actions.append("提前锁定库存并优先排单")
            level = "MEDIUM"
        if order.manual_review_required:
            anomalies.append("订单需人工复核")
            actions.append("转人工复核后再履约")
            level = "MEDIUM"

    # 售后联动建议：高风险 / 地址问题 / 需人工复核 时建议售后前置介入
    after_sale = level == "HIGH" or not order.address_complete or order.manual_review_required
    if after_sale:
        reason = "物流风险较高" if level == "HIGH" else "存在履约不确定性"
        after_sale_reason = f"{reason}，建议售后提前介入跟进客户与物流异常"
    else:
        after_sale_reason = ""

    return LogisticsRiskResult(
        logistics_risk_level=level,
        anomaly_details=anomalies,
        suggested_actions=actions,
        after_sale_suggested=after_sale,
        after_sale_reason=after_sale_reason,
    )
