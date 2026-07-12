from app.agents.logistics import compute_logistics_risk
from app.llm import client as llm_client
from app.schemas.agent_outputs import FulfillmentPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


_SYSTEM_PROMPT = (
    "你是一名订单履约运营专家。根据订单与库存上下文，判断是否可以发货、"
    "履约状态、风险标记，以及是否需要人工确认，并给出建议的下一步订单状态。"
    "使用简体中文，状态与风险需基于上下文事实，不要臆造。"
)


def _logistics_to_plan(risk) -> dict:
    """把确定性物流结论映射为 FulfillmentPlan 字段（权威源，规则与 LLM 共用）。"""
    return {
        "logistics_risk_level": risk.logistics_risk_level,
        "anomaly_details": risk.anomaly_details,
        "suggested_actions": risk.suggested_actions,
        "after_sale_suggested": risk.after_sale_suggested,
        "after_sale_reason": risk.after_sale_reason,
    }


def _logistics_summary(risk) -> str:
    if not risk.anomaly_details:
        return "物流风险等级 LOW，未检测到异常，无需特殊处理后置。"
    lines = [f"物流风险等级 {risk.logistics_risk_level}。"]
    lines.append("检测到的异常：" + "；".join(risk.anomaly_details))
    lines.append("建议处理：" + "；".join(risk.suggested_actions))
    if risk.after_sale_suggested:
        lines.append(f"售后联动：{risk.after_sale_reason}")
    return "\n".join(lines)


class OrderFulfillmentAgent:
    def run(self, order: OrderContext, inventory: InventoryContext) -> FulfillmentPlan:
        # 确定性物流风险始终计算，作为规则与 LLM 共用的权威结论。
        risk = compute_logistics_risk(order, inventory)
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(order, inventory, risk)

        user_prompt = (
            "订单上下文（JSON）：\n"
            f"{order.model_dump_json(indent=2)}\n\n"
            "库存上下文（JSON）：\n"
            f"{inventory.model_dump_json(indent=2)}\n\n"
            "物流风险参考（基于上下文的确定性推算，请据此保持一致）：\n"
            f"{_logistics_summary(risk)}\n\n"
            "请按 FulfillmentPlan 的结构化字段输出履约建议。"
        )
        plan = client.generate(_SYSTEM_PROMPT, user_prompt, FulfillmentPlan)
        # 用权威物流结论覆盖 LLM 可能臆造的字段，保证落库与 trace 一致。
        return plan.model_copy(update=_logistics_to_plan(risk))

    def _rule_based_run(
        self, order: OrderContext, inventory: InventoryContext, risk=None
    ) -> FulfillmentPlan:
        if risk is None:
            risk = compute_logistics_risk(order, inventory)

        risk_flags: list[str] = []
        available_stock = inventory.current_stock - inventory.reserved_stock
        if not order.paid:
            risk_flags.append("订单未付款")
        if not order.address_complete:
            risk_flags.append("收货地址不完整")
        if available_stock < order.quantity:
            risk_flags.append("可用库存不足")

        can_ship = not risk_flags
        next_status = "READY_TO_SHIP" if can_ship else "NEEDS_REVIEW"

        return FulfillmentPlan(
            can_ship=can_ship,
            fulfillment_status=next_status,
            risk_flags=risk_flags,
            manual_review_required=not can_ship,
            next_order_status=next_status,
            **_logistics_to_plan(risk),
        )
