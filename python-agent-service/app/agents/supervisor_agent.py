from time import perf_counter
from uuid import uuid4

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.schemas.agent_outputs import FulfillmentPlan, ImagePlan, InventoryPlan, ProductPlan
from app.schemas.inventory import InventoryContext
from app.schemas.operation_plan import AgentRunRecord, OperationPlanResult
from app.schemas.order import OrderContext
from app.schemas.product import ProductContext


class SupervisorAgent:
    def __init__(self) -> None:
        self.product_agent = ProductPlanningAgent()
        self.image_agent = ImageCreativeAgent()
        self.inventory_agent = InventoryPurchaseAgent()
        self.fulfillment_agent = OrderFulfillmentAgent()

    def run(
        self,
        product: ProductContext,
        inventory: InventoryContext,
        order: OrderContext,
        trigger_type: str,
    ) -> OperationPlanResult:
        trace_id = f"trace_{uuid4().hex}"
        agent_runs: list[AgentRunRecord] = []
        errors: list[dict] = []

        supervisor_start = perf_counter()
        product_plan, product_run = self._time_agent(
            "PRODUCT_PLANNING_AGENT",
            lambda: self.product_agent.run(product),
        )
        agent_runs.append(product_run)

        image_plan, image_run = self._time_agent(
            "IMAGE_CREATIVE_AGENT",
            lambda: self.image_agent.run(product, product_plan),
        )
        agent_runs.append(image_run)

        inventory_plan, inventory_run = self._time_agent(
            "INVENTORY_PURCHASE_AGENT",
            lambda: self.inventory_agent.run(inventory, order),
        )
        agent_runs.append(inventory_run)

        fulfillment_plan, fulfillment_run = self._time_agent(
            "ORDER_FULFILLMENT_AGENT",
            lambda: self.fulfillment_agent.run(order, inventory),
        )
        agent_runs.append(fulfillment_run)

        manual_review_required = fulfillment_plan.manual_review_required
        final_summary = self._summarize(
            product_plan=product_plan,
            image_plan=image_plan,
            inventory_plan=inventory_plan,
            fulfillment_plan=fulfillment_plan,
            trigger_type=trigger_type,
        )

        supervisor_duration = int((perf_counter() - supervisor_start) * 1000)
        agent_runs.insert(
            0,
            AgentRunRecord(
                agent_name="SUPERVISOR_AGENT",
                status="SUCCESS",
                duration_ms=supervisor_duration,
            ),
        )

        return OperationPlanResult(
            trace_id=trace_id,
            product_plan=product_plan,
            image_plan=image_plan,
            inventory_plan=inventory_plan,
            fulfillment_plan=fulfillment_plan,
            final_summary=final_summary,
            manual_review_required=manual_review_required,
            errors=errors,
            agent_runs=agent_runs,
        )

    def _time_agent(self, agent_name: str, run_agent):
        start = perf_counter()
        output = run_agent()
        duration_ms = int((perf_counter() - start) * 1000)
        return output, AgentRunRecord(
            agent_name=agent_name,
            status="SUCCESS",
            duration_ms=duration_ms,
        )

    def _summarize(
        self,
        product_plan: ProductPlan,
        image_plan: ImagePlan,
        inventory_plan: InventoryPlan,
        fulfillment_plan: FulfillmentPlan,
        trigger_type: str,
    ) -> str:
        return (
            f"触发类型 {trigger_type}。"
            f"商品建议标题为：{product_plan.recommended_title}。"
            f"图片风格建议为：{image_plan.image_style}。"
            f"库存状态为：{inventory_plan.inventory_status}，"
            f"补货优先级为：{inventory_plan.restock_priority}。"
            f"订单下一步建议状态为：{fulfillment_plan.next_order_status}。"
        )
