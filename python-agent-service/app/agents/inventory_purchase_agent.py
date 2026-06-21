from app.schemas.agent_outputs import InventoryPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


class InventoryPurchaseAgent:
    def run(self, inventory: InventoryContext, order: OrderContext) -> InventoryPlan:
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
