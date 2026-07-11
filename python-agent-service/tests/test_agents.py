from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.agents.supervisor_agent import SupervisorAgent
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext
from app.schemas.product import ProductContext


def sample_product() -> ProductContext:
    return ProductContext(
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


def sample_low_inventory() -> InventoryContext:
    return InventoryContext(
        product_id=1001,
        current_stock=18,
        reserved_stock=5,
        safe_stock_threshold=20,
        purchase_cycle_days=5,
        sales_last_7_days=32,
        inventory_status="LOW",
    )


def sample_paid_order() -> OrderContext:
    return OrderContext(
        order_id=2001,
        product_id=1001,
        quantity=2,
        status="PENDING_ANALYSIS",
        address_complete=True,
        paid=True,
        manual_review_required=False,
        fulfillment_suggestion_status="PENDING_ANALYSIS",
    )


def test_product_planning_agent_generates_listing_plan():
    plan = ProductPlanningAgent().run(sample_product())

    assert "便携式榨汁杯" in plan.recommended_title
    assert len(plan.selling_points) == 3
    assert plan.detail_description
    assert plan.listing_suggestion
    assert plan.seo_keywords
    assert plan.meta_description
    assert set(plan.platform_copies.keys()) == {"taobao", "douyin", "xiaohongshu"}


def test_image_creative_agent_uses_product_selling_points():
    product = sample_product()
    product_plan = ProductPlanningAgent().run(product)

    image_plan = ImageCreativeAgent().run(product, product_plan)

    assert "便携式榨汁杯" in image_plan.main_image_prompt
    assert "办公室" in image_plan.scene_image_prompt
    assert image_plan.image_style
    assert image_plan.image_risk_notes


def test_inventory_purchase_agent_flags_low_available_stock():
    inventory_plan = InventoryPurchaseAgent().run(sample_low_inventory(), sample_paid_order())

    assert inventory_plan.inventory_status == "RISK"
    assert inventory_plan.should_restock is True
    assert inventory_plan.suggested_restock_quantity > 0
    assert inventory_plan.restock_priority == "HIGH"


def test_order_fulfillment_agent_allows_paid_order_with_stock():
    fulfillment_plan = OrderFulfillmentAgent().run(sample_paid_order(), sample_low_inventory())

    assert fulfillment_plan.can_ship is True
    assert fulfillment_plan.fulfillment_status == "READY_TO_SHIP"
    assert fulfillment_plan.manual_review_required is False
    assert fulfillment_plan.next_order_status == "READY_TO_SHIP"


def test_order_fulfillment_agent_requires_review_for_unpaid_order():
    order = sample_paid_order().model_copy(update={"paid": False})

    fulfillment_plan = OrderFulfillmentAgent().run(order, sample_low_inventory())

    assert fulfillment_plan.can_ship is False
    assert fulfillment_plan.manual_review_required is True
    assert "订单未付款" in fulfillment_plan.risk_flags
    assert fulfillment_plan.next_order_status == "NEEDS_REVIEW"


def test_supervisor_agent_runs_all_agents_and_summarizes_result():
    result = SupervisorAgent().run(
        product=sample_product(),
        inventory=sample_low_inventory(),
        order=sample_paid_order(),
        trigger_type="GENERATE_OPERATION_PLAN",
    )

    assert result.trace_id.startswith("trace_")
    assert result.product_plan.recommended_title
    assert result.image_plan.main_image_prompt
    assert result.inventory_plan.should_restock is True
    assert result.fulfillment_plan.can_ship is True
    assert result.final_summary
    assert result.manual_review_required is False
    assert [run.agent_name for run in result.agent_runs] == [
        "SUPERVISOR_AGENT",
        "PRODUCT_PLANNING_AGENT",
        "IMAGE_CREATIVE_AGENT",
        "INVENTORY_PURCHASE_AGENT",
        "ORDER_FULFILLMENT_AGENT",
    ]
