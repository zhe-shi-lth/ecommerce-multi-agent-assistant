from fastapi import APIRouter

from app.agents.supervisor_agent import SupervisorAgent
from app.schemas.operation_plan import OperationPlanRequest, OperationPlanResult
from app.tools.java_api_client import JavaApiClient

router = APIRouter(prefix="/agent/ecommerce", tags=["operation-plan"])


@router.post("/operation-plan")
def create_operation_plan(request: OperationPlanRequest) -> OperationPlanResult:
    result = SupervisorAgent().run(
        product=request.product,
        inventory=request.inventory,
        order=request.order,
        trigger_type=request.trigger_type,
    )

    # Task 11：把生成的运营计划与执行记录写回 Java（Python 调 Java 闭环）。
    # 作为副作用执行；Java 不可用时记录日志但不影响计划返回，保证 Python 可独立运行。
    client = JavaApiClient()
    operation_plan_id = client.persist_operation_plan(
        product_id=request.product.product_id,
        order_id=request.order.order_id,
        result=result,
    )
    if operation_plan_id is not None:
        client.persist_agent_runs(operation_plan_id, result)

    return result
