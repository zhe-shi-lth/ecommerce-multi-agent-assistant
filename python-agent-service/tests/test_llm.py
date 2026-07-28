import pytest

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.agents.supervisor_agent import SupervisorAgent
from app.llm import LLMClient, StubClient
from app.schemas.agent_outputs import (
    FulfillmentPlan,
    ImagePlan,
    InventoryPlan,
    ProductPlan,
)
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext
from app.schemas.product import ProductContext


def _stub_factory(system: str, user: str, schema: type):
    if schema is ProductPlan:
        return ProductPlan(
            recommended_title="STUB_TITLE",
            selling_points=["s1"],
            detail_description="d",
            target_user_summary="t",
            listing_suggestion="l",
            seo_keywords=["k1"],
            meta_description="m",
            platform_copies={"taobao": "t", "douyin": "d", "xiaohongshu": "x"},
        )
    if schema is ImagePlan:
        return ImagePlan(
            main_image_prompt="m",
            scene_image_prompt="s",
            marketing_image_prompt="mk",
            image_style="stub",
            image_risk_notes=[],
        )
    if schema is InventoryPlan:
        return InventoryPlan(
            inventory_status="ENOUGH",
            should_restock=False,
            suggested_restock_quantity=0,
            restock_priority="LOW",
            reason="stub",
        )
    if schema is FulfillmentPlan:
        return FulfillmentPlan(
            can_ship=True,
            fulfillment_status="READY_TO_SHIP",
            risk_flags=[],
            manual_review_required=False,
            next_order_status="READY_TO_SHIP",
        )
    raise AssertionError(f"unexpected schema {schema}")


def _sample_product() -> ProductContext:
    return ProductContext(
        product_id=1001,
        name="便携式榨汁杯",
        category="小家电",
        description="适合办公室和健身房使用的小型榨汁杯",
        cost_price=39.0,
        sale_price=89.0,
        target_audience="上班族",
        usage_scenario="办公室",
        status="DRAFT",
    )


def _sample_inventory() -> InventoryContext:
    return InventoryContext(
        product_id=1001,
        current_stock=18,
        reserved_stock=5,
        safe_stock_threshold=20,
        purchase_cycle_days=5,
        sales_last_7_days=32,
        inventory_status="LOW",
    )


def _sample_order() -> OrderContext:
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


def test_agents_use_llm_client_when_enabled(monkeypatch):
    stub = StubClient(_stub_factory)
    monkeypatch.setattr("app.llm.client.get_llm_client", lambda: stub)

    product_plan = ProductPlanningAgent().run(_sample_product())
    assert isinstance(product_plan, ProductPlan)
    assert product_plan.recommended_title == "STUB_TITLE"

    image_plan = ImageCreativeAgent().run(_sample_product(), product_plan)
    assert isinstance(image_plan, ImagePlan)
    assert image_plan.image_style == "stub"

    inventory_plan = InventoryPurchaseAgent().run(_sample_inventory(), _sample_order())
    assert isinstance(inventory_plan, InventoryPlan)

    fulfillment_plan = OrderFulfillmentAgent().run(_sample_order(), _sample_inventory())
    assert isinstance(fulfillment_plan, FulfillmentPlan)


def test_supervisor_raises_on_llm_failure(monkeypatch):
    class FailingClient(LLMClient):
        def generate(self, system, user, schema):
            raise RuntimeError("ollama unavailable")

    monkeypatch.setattr("app.llm.client.get_llm_client", lambda: FailingClient())

    # 选中了 LLM 但调用持续失败 → 如实抛错（不降级到规则实现）。
    with pytest.raises(RuntimeError):
        SupervisorAgent().run(
            product=_sample_product(),
            inventory=_sample_inventory(),
            order=_sample_order(),
            trigger_type="GENERATE_OPERATION_PLAN",
        )
