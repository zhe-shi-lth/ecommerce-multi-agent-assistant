from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.schemas.agent_outputs import FulfillmentPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext

router = APIRouter(prefix="/agent/ecommerce", tags=["order-fulfillment"])


class OrderFulfillmentRequest(BaseModel):
    """请求体：订单上下文 + 库存上下文，供履约 Agent 重算履约结论。"""

    order: OrderContext
    inventory: InventoryContext


@router.post("/order-fulfillment")
def recompute_order_fulfillment(request: OrderFulfillmentRequest) -> FulfillmentPlan:
    """按当前订单/库存上下文重算履约结论（确定性物流内核 + LLM 双路）。

    典型用途：地址补全后由 Java 调用来刷新履约建议，无需再跑完整运营计划。
    """
    return OrderFulfillmentAgent().run(order=request.order, inventory=request.inventory)
