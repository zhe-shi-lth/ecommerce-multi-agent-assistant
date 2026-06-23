from fastapi import APIRouter

from app.agents.supervisor_agent import SupervisorAgent
from app.schemas.operation_plan import OperationPlanRequest, OperationPlanResult

router = APIRouter(prefix="/agent/ecommerce", tags=["operation-plan"])


@router.post("/operation-plan")
def create_operation_plan(request: OperationPlanRequest) -> OperationPlanResult:
    return SupervisorAgent().run(
        product=request.product,
        inventory=request.inventory,
        order=request.order,
        trigger_type=request.trigger_type,
    )
