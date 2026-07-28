from typing import Optional

from app.agents.forecast import compute_forecast
from app.llm import client as llm_client
from app.schemas.agent_outputs import InventoryPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


_SYSTEM_PROMPT = (
    "你是一名库存与采购运营专家。根据库存与订单上下文，判断库存状态、"
    "是否需要补货、建议补货数量与优先级，并给出可读的原因说明。"
    "使用简体中文，数字与状态需与上下文及下方「参考预测」一致，不要臆造数据。"
)


def _forecast_to_plan(forecast) -> dict:
    """把确定性预测结果映射为 InventoryPlan 字段（决策与数字均为权威源，规则与 LLM 共用）。

    LLM 路径只贡献可读性 reason，状态/补货/优先级等决策一律由此确定性预测决定，
    避免 LLM 臆造导致落库与 trace 不一致。
    """
    return {
        "inventory_status": forecast.inventory_status,
        "should_restock": forecast.should_restock,
        "suggested_restock_quantity": forecast.suggested_restock_quantity,
        "restock_priority": forecast.restock_priority,
        "daily_demand": forecast.daily_demand,
        "available_stock": forecast.available_stock,
        "projected_stock": forecast.projected_stock,
        "purchase_cycle_days": forecast.purchase_cycle_days,
        "days_to_stockout": forecast.days_to_stockout,
        "required_coverage": forecast.required_coverage,
    }


def _forecast_summary(forecast) -> str:
    stockout = "永不售罄" if forecast.days_to_stockout is None else f"{forecast.days_to_stockout} 天"
    return (
        f"日均需求约 {forecast.daily_demand:.2f}；可用库存 {forecast.available_stock}；"
        f"扣减本单后预计库存 {forecast.projected_stock}；采购周期 {forecast.purchase_cycle_days} 天；"
        f"预计 {stockout} 后售罄；需覆盖需求 {forecast.required_coverage:.2f}；"
        f"建议补货量 {forecast.suggested_restock_quantity}；"
        f"状态 {forecast.inventory_status}；优先级 {forecast.restock_priority}。"
    )


class InventoryPurchaseAgent:
    def run(
        self, inventory: InventoryContext, order: Optional[OrderContext] = None
    ) -> InventoryPlan:
        # 主动补货场景（线2 补货清单）无关联订单：用零数量订单兜底，
        # 让确定性内核只按"库存 + 前置期 + 安全库存"推算补货量。
        if order is None:
            order = OrderContext(
                order_id=0,
                product_id=inventory.product_id,
                quantity=0,
                status="NONE",
                address_complete=True,
                paid=True,
                manual_review_required=False,
                fulfillment_suggestion_status="NONE",
            )
        # 确定性预测始终计算，作为规则与 LLM 共用的权威数字。
        forecast = compute_forecast(inventory, order)
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(inventory, order, forecast)

        user_prompt = (
            "库存上下文（JSON）：\n"
            f"{inventory.model_dump_json(indent=2)}\n\n"
            "订单上下文（JSON）：\n"
            f"{order.model_dump_json(indent=2)}\n\n"
            "参考预测（基于销量历史的确定性推算，请据此保持一致）：\n"
            f"{_forecast_summary(forecast)}\n\n"
            "请按 InventoryPlan 的结构化字段输出库存与采购建议。"
        )
        plan = client.generate(_SYSTEM_PROMPT, user_prompt, InventoryPlan)
        # 用权威预测数字覆盖 LLM 可能臆造的字段，保证落库与 trace 一致。
        return plan.model_copy(update=_forecast_to_plan(forecast))

    def _rule_based_run(
        self, inventory: InventoryContext, order: OrderContext, forecast=None
    ) -> InventoryPlan:
        if forecast is None:
            forecast = compute_forecast(inventory, order)

        reason = (
            f"可用库存为 {forecast.available_stock}，订单占用后预计库存为 {forecast.projected_stock}，"
            f"安全库存阈值为 {inventory.safe_stock_threshold}；近 7 日销量 {inventory.sales_last_7_days}，"
            f"日均需求约 {forecast.daily_demand:.2f}，预计 {forecast.days_to_stockout} 天售罄，"
            f"需覆盖需求约 {forecast.required_coverage:.2f}。"
        )

        return InventoryPlan(
            reason=reason,
            **_forecast_to_plan(forecast),
        )
