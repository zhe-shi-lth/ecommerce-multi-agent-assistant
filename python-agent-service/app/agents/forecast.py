"""库存与采购的确定性需求预测。

设计原则：
- 不依赖外部服务、不引时序库，纯统计推算，保证规则路径与 LLM 提示词共用同一套数字。
- 当前仅基于 `sales_last_7_days`（近 7 日销量聚合）推算日均需求；这是步骤 4 选定
  「不扩充历史销量字段」下的轻量实现，已显著优于静态阈值规则（把采购周期/前置期
  与需求速率纳入考量）。
- 返回 `ForecastResult` 供 `_rule_based_run` 直接填充 InventoryPlan，也供 LLM 提示词
  作为「参考预测值」注入，让 LLM 的文案与统计结果保持一致。
"""
from dataclasses import dataclass
from math import ceil

from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


@dataclass
class ForecastResult:
    daily_demand: float
    available_stock: int
    projected_stock: int
    purchase_cycle_days: int
    days_to_stockout: int | None
    required_coverage: float
    suggested_restock_quantity: int
    should_restock: bool
    inventory_status: str
    restock_priority: str


def compute_forecast(inventory: InventoryContext, order: OrderContext) -> ForecastResult:
    """基于销量历史与采购周期，推算需求与补货建议（确定性、无随机性）。"""
    daily_demand = inventory.sales_last_7_days / 7.0
    available_stock = inventory.current_stock - inventory.reserved_stock
    projected_stock = available_stock - order.quantity
    horizon = inventory.purchase_cycle_days

    # 预计售罄天数：无需求则视为永不售罄（None）。
    days_to_stockout: int | None
    if daily_demand > 0:
        days_to_stockout = int(projected_stock / daily_demand)
    else:
        days_to_stockout = None

    # 前置期内需覆盖的需求 + 安全库存。
    required_coverage = daily_demand * horizon + inventory.safe_stock_threshold
    suggested_restock_quantity = max(0, int(ceil(required_coverage - projected_stock)))

    # 触发补货：预计库存低于安全阈值，或在前置期内就会售罄。
    should_restock = projected_stock < inventory.safe_stock_threshold or (
        days_to_stockout is not None and days_to_stockout <= horizon
    )

    if should_restock and (days_to_stockout is not None and days_to_stockout <= horizon):
        inventory_status = "RISK"
        restock_priority = "HIGH"
    elif should_restock:
        inventory_status = "LOW"
        restock_priority = "MEDIUM"
    else:
        inventory_status = "ENOUGH"
        restock_priority = "LOW"

    return ForecastResult(
        daily_demand=daily_demand,
        available_stock=available_stock,
        projected_stock=projected_stock,
        purchase_cycle_days=horizon,
        days_to_stockout=days_to_stockout,
        required_coverage=required_coverage,
        suggested_restock_quantity=suggested_restock_quantity,
        should_restock=should_restock,
        inventory_status=inventory_status,
        restock_priority=restock_priority,
    )
