from time import perf_counter
from uuid import uuid4

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.rag.service import get_knowledge_service
from app.schemas.inventory import InventoryContext
from app.schemas.operation_plan import AgentRunRecord, OperationPlanResult
from app.schemas.order import OrderContext
from app.schemas.product import ProductContext

# 条件路由表：trigger_type -> 有序步骤列表。未知 trigger 默认全量（保持向后兼容）。
_ROUTING: dict[str, list[str]] = {
    "GENERATE_OPERATION_PLAN": ["product", "image", "inventory", "fulfillment"],
    # 演示用分支：只看库存与履约，跳过商品规划/图片创意（体现动态路由）
    "INVENTORY_REVIEW": ["inventory", "fulfillment"],
}
_DEFAULT_STEPS = ["product", "image", "inventory", "fulfillment"]

# LLM 调用失败后的重试次数（仍失败则降级规则实现，不中断主链路）。
_LLM_RETRY = 1


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

        # 检索一次分类知识库，下传给商品规划与图片创意两个 Agent
        knowledge = get_knowledge_service().retrieve_for_product(product)

        product_plan = image_plan = inventory_plan = fulfillment_plan = None
        steps = _ROUTING.get(trigger_type, _DEFAULT_STEPS)

        for step in steps:
            if step == "product":
                product_plan, run = self._safe_run(
                    "PRODUCT_PLANNING_AGENT",
                    lambda: self.product_agent.run(product, knowledge),
                    {"product": product.model_dump(), "retrieved_knowledge": knowledge},
                    errors,
                )
                agent_runs.append(run)
            elif step == "image":
                image_plan, run = self._safe_run(
                    "IMAGE_CREATIVE_AGENT",
                    lambda: self.image_agent.run(product, knowledge),
                    {
                        "product": product.model_dump(),
                        "retrieved_knowledge": knowledge,
                    },
                    errors,
                )
                agent_runs.append(run)
            elif step == "inventory":
                inventory_plan, run = self._safe_run(
                    "INVENTORY_PURCHASE_AGENT",
                    lambda: self.inventory_agent.run(inventory, order),
                    {"inventory": inventory.model_dump(), "order": order.model_dump()},
                    errors,
                )
                agent_runs.append(run)
            elif step == "fulfillment":
                fulfillment_plan, run = self._safe_run(
                    "ORDER_FULFILLMENT_AGENT",
                    lambda: self.fulfillment_agent.run(order, inventory),
                    {"order": order.model_dump(), "inventory": inventory.model_dump()},
                    errors,
                )
                agent_runs.append(run)

        manual_review_required = bool(
            fulfillment_plan and fulfillment_plan.manual_review_required
        )
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

    def _safe_run(self, agent_name: str, run_fn, input_json: dict, errors: list[dict]):
        """运行 Agent：成功记 SUCCESS；对**同一配置厂家**做瞬态重试，仍失败则如实抛出。

        不再降级到规则实现——配置缺失/厂家不支持/调用失败一律向上抛异常，
        由 API 层统一转成用户友好报错（符合「不降级、直接报错」）。离线/规则模式下
        run_fn 本身走确定性规则输出，不会进入失败分支。
        """
        start = perf_counter()
        output = None
        status = "SUCCESS"
        error_message = None

        for attempt in range(_LLM_RETRY + 1):
            try:
                output = run_fn()
                break
            except Exception as exc:  # noqa: BLE001
                error_message = f"{type(exc).__name__}: {exc}"
                if attempt < _LLM_RETRY:
                    continue
                # 重试耗尽仍失败：如实抛出，由端点统一转成报错（不降级到规则）。
                raise

        duration_ms = int((perf_counter() - start) * 1000)
        record = AgentRunRecord(
            agent_name=agent_name,
            status=status,
            duration_ms=duration_ms,
            input_json=input_json,
            output_json=output.model_dump() if output is not None else None,
            error_message=error_message,
        )
        return output, record

    def _summarize(
        self,
        product_plan,
        image_plan,
        inventory_plan,
        fulfillment_plan,
        trigger_type: str,
    ) -> str:
        parts = [f"触发类型 {trigger_type}。"]
        if product_plan:
            parts.append(f"商品建议标题为：{product_plan.recommended_title}。")
        if image_plan:
            parts.append(f"图片风格建议为：{image_plan.image_style}。")
        if inventory_plan:
            parts.append(
                f"库存状态为：{inventory_plan.inventory_status}，"
                f"补货优先级为：{inventory_plan.restock_priority}。"
            )
        if fulfillment_plan:
            parts.append(
                f"订单下一步建议状态为：{fulfillment_plan.next_order_status}。"
            )
        return "".join(parts)
