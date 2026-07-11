from app.llm import client as llm_client
from app.schemas.agent_outputs import FulfillmentPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext

_SYSTEM_PROMPT = (
    "你是一名订单履约运营专家。根据订单与库存上下文，判断是否可以发货、"
    "履约状态、风险标记，以及是否需要人工确认，并给出建议的下一步订单状态。"
    "使用简体中文，状态与风险需基于上下文事实，不要臆造。"
)


class OrderFulfillmentAgent:
    def run(self, order: OrderContext, inventory: InventoryContext) -> FulfillmentPlan:
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(order, inventory)
        user_prompt = (
            "订单上下文（JSON）：\n"
            f"{order.model_dump_json(indent=2)}\n\n"
            "库存上下文（JSON）：\n"
            f"{inventory.model_dump_json(indent=2)}\n\n"
            "请按 FulfillmentPlan 的结构化字段输出履约建议。"
        )
        return client.generate(_SYSTEM_PROMPT, user_prompt, FulfillmentPlan)

    def _rule_based_run(self, order: OrderContext, inventory: InventoryContext) -> FulfillmentPlan:
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
        )
