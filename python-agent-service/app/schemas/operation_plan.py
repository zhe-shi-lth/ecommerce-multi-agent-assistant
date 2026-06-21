from pydantic import BaseModel, Field

from app.schemas.agent_outputs import FulfillmentPlan, ImagePlan, InventoryPlan, ProductPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext
from app.schemas.product import ProductContext


class OperationPlanRequest(BaseModel):
    product: ProductContext
    inventory: InventoryContext
    order: OrderContext
    trigger_type: str


class AgentRunRecord(BaseModel):
    agent_name: str
    status: str
    duration_ms: int = Field(ge=0)
    input_json: dict | None = None
    output_json: dict | None = None
    error_message: str | None = None


class OperationPlanResult(BaseModel):
    trace_id: str
    product_plan: ProductPlan
    image_plan: ImagePlan
    inventory_plan: InventoryPlan
    fulfillment_plan: FulfillmentPlan
    final_summary: str = Field(min_length=1)
    manual_review_required: bool
    errors: list[dict]
    agent_runs: list[AgentRunRecord]
