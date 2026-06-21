from app.schemas.agent_outputs import FulfillmentPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


class OrderFulfillmentAgent:
    def run(self, order: OrderContext, inventory: InventoryContext) -> FulfillmentPlan:
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
