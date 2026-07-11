from app.llm import client as llm_client
from app.schemas.agent_outputs import InventoryPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext

_SYSTEM_PROMPT = (
    "你是一名库存与采购运营专家。根据库存与订单上下文，判断库存状态、"
    "是否需要补货、建议补货数量与优先级，并给出可读的原因说明。"
    "使用简体中文，数字与状态需与上下文一致，不要臆造数据。"
)


class InventoryPurchaseAgent:
    def run(self, inventory: InventoryContext, order: OrderContext) -> InventoryPlan:
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(inventory, order)
        user_prompt = (
            "库存上下文（JSON）：\n"
            f"{inventory.model_dump_json(indent=2)}\n\n"
            "订单上下文（JSON）：\n"
            f"{order.model_dump_json(indent=2)}\n\n"
            "请按 InventoryPlan 的结构化字段输出库存与采购建议。"
        )
        return client.generate(_SYSTEM_PROMPT, user_prompt, InventoryPlan)

    def _rule_based_run(self, inventory: InventoryContext, order: OrderContext) -> InventoryPlan:
        available_stock = inventory.current_stock - inventory.reserved_stock
        projected_stock = available_stock - order.quantity
        should_restock = projected_stock < inventory.safe_stock_threshold
        high_sales = inventory.sales_last_7_days >= inventory.safe_stock_threshold

        if should_restock and high_sales:
            status = "RISK"
            priority = "HIGH"
        elif should_restock:
            status = "LOW"
            priority = "MEDIUM"
        else:
            status = "ENOUGH"
            priority = "LOW"

        suggested_quantity = 0
        if should_restock:
            suggested_quantity = max(
                inventory.safe_stock_threshold * 2 - projected_stock,
                order.quantity,
            )

        return InventoryPlan(
            inventory_status=status,
            should_restock=should_restock,
            suggested_restock_quantity=suggested_quantity,
            restock_priority=priority,
            reason=(
                f"可用库存为 {available_stock}，订单占用后预计库存为 {projected_stock}，"
                f"安全库存阈值为 {inventory.safe_stock_threshold}。"
            ),
        )
