import pytest
from pydantic import ValidationError

from app.schemas.agent_outputs import (
    FulfillmentPlan,
    ImagePlan,
    InventoryPlan,
    ProductPlan,
)
from app.schemas.inventory import InventoryContext
from app.schemas.operation_plan import AgentRunRecord, OperationPlanRequest, OperationPlanResult
from app.schemas.order import OrderContext
from app.schemas.product import ProductContext


def test_operation_plan_result_serializes_nested_agent_outputs():
    product = ProductContext(
        product_id=1001,
        name="便携式榨汁杯",
        category="小家电",
        description="适合办公室和健身房使用的小型榨汁杯",
        cost_price=39.0,
        sale_price=89.0,
        target_audience="上班族、健身人群、学生",
        usage_scenario="办公室、健身房、宿舍、旅行",
        status="DRAFT",
    )
    inventory = InventoryContext(
        product_id=1001,
        current_stock=18,
        reserved_stock=5,
        safe_stock_threshold=20,
        purchase_cycle_days=5,
        sales_last_7_days=32,
        inventory_status="LOW",
    )
    order = OrderContext(
        order_id=2001,
        product_id=1001,
        quantity=2,
        status="PENDING_ANALYSIS",
        address_complete=True,
        paid=True,
        manual_review_required=False,
        fulfillment_suggestion_status="PENDING_ANALYSIS",
    )
    request = OperationPlanRequest(
        product=product,
        inventory=inventory,
        order=order,
        trigger_type="GENERATE_OPERATION_PLAN",
    )

    result = OperationPlanResult(
        trace_id="trace-001",
        product_plan=ProductPlan(
            recommended_title="便携式榨汁杯 办公室健身房小型果汁机",
            selling_points=["便携随行", "一键榨汁", "多场景使用"],
            detail_description="适合日常果蔬饮品制作。",
            target_user_summary="适合关注健康饮食的用户。",
            listing_suggestion="突出便携、易清洗和多场景使用。",
        ),
        image_plan=ImagePlan(
            main_image_prompt="白色背景，突出杯身和便携性。",
            scene_image_prompt="办公室桌面使用场景。",
            marketing_image_prompt="突出一键榨汁、便携随行、易清洗。",
            image_style="清新明亮",
            image_risk_notes=["避免夸大功效"],
        ),
        inventory_plan=InventoryPlan(
            inventory_status="RISK",
            should_restock=True,
            suggested_restock_quantity=50,
            restock_priority="HIGH",
            reason="可用库存低于安全库存，存在断货风险。",
        ),
        fulfillment_plan=FulfillmentPlan(
            can_ship=True,
            fulfillment_status="READY_TO_SHIP",
            risk_flags=[],
            manual_review_required=False,
            next_order_status="READY_TO_SHIP",
        ),
        final_summary="商品适合上架，库存存在断货风险，当前订单可出货。",
        manual_review_required=False,
        errors=[],
        agent_runs=[
            AgentRunRecord(
                agent_name="SUPERVISOR_AGENT",
                status="SUCCESS",
                duration_ms=12,
            )
        ],
    )

    payload = result.model_dump()

    assert request.trigger_type == "GENERATE_OPERATION_PLAN"
    assert payload["trace_id"] == "trace-001"
    assert payload["product_plan"]["selling_points"] == ["便携随行", "一键榨汁", "多场景使用"]
    assert payload["inventory_plan"]["should_restock"] is True
    assert payload["fulfillment_plan"]["next_order_status"] == "READY_TO_SHIP"
    assert payload["agent_runs"][0]["agent_name"] == "SUPERVISOR_AGENT"


def test_product_context_requires_product_name():
    with pytest.raises(ValidationError):
        ProductContext(
            product_id=1001,
            category="小家电",
            description="适合办公室使用",
            cost_price=39.0,
            sale_price=89.0,
            target_audience="上班族",
            usage_scenario="办公室",
            status="DRAFT",
        )
