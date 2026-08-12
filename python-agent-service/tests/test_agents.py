import pytest

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.agents.supervisor_agent import SupervisorAgent
from app.errors import ConfigError
from app.llm import client as llm_client
from app.llm.client import StubClient
from app.schemas.agent_outputs import (
    FulfillmentPlan,
    ImagePlan,
    ImageReviewResult,
    InventoryPlan,
    ProductPlan,
)
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
    with pytest.raises(ConfigError, match="文本大模型"):
        ProductPlanningAgent().run(sample_product())


def test_image_creative_agent_uses_product_selling_points():
    product = sample_product()
    with pytest.raises(ConfigError, match="文本大模型"):
        ImageCreativeAgent().run(product, notes="测试备注")


def test_image_review_rule_based_maps_risk_notes():
    image_plan = ImagePlan(
        main_image_prompt="白色背景展示商品",
        scene_image_prompt="场景图",
        marketing_image_prompt="营销图",
        image_style="电商风格",
        image_risk_notes=["避免夸大功效", "避免使用侵权品牌元素"],
    )
    review = ImageCreativeAgent()._review_rule_based(image_plan, knowledge="")
    assert review is not None
    assert review.reviewer == "rule"
    assert review.risk_level == "中风险"
    assert review.overall_score == 70
    assert "避免夸大功效" in review.issues


def test_image_creative_agent_llm_review_attached(monkeypatch):
    def factory(system, user, schema):
        if schema is ImagePlan:
            return ImagePlan(
                main_image_prompt="主图",
                scene_image_prompt="场景图",
                marketing_image_prompt="营销图",
                image_style="电商风格",
                image_risk_notes=["避免夸大功效"],
            )
        if schema is ImageReviewResult:
            return ImageReviewResult(
                overall_score=92,
                risk_level="低风险",
                issues=[],
                suggestions=["可直接使用"],
                reviewer="llm",
            )
        raise AssertionError(f"unexpected schema {schema}")

    product = sample_product()

    monkeypatch.setattr(llm_client, "get_llm_client", lambda: StubClient(factory))
    image_plan = ImageCreativeAgent().run(product, notes="测试备注")

    assert image_plan.image_review_result is not None
    assert image_plan.image_review_result.reviewer == "llm"
    assert image_plan.image_review_result.overall_score == 92


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
    with pytest.raises(ConfigError, match="文本大模型"):
        SupervisorAgent().run(
            product=sample_product(),
            inventory=sample_low_inventory(),
            order=sample_paid_order(),
            trigger_type="GENERATE_OPERATION_PLAN",
        )


def test_supervisor_routes_inventory_review_skips_product_and_image():
    result = SupervisorAgent().run(
        product=sample_product(),
        inventory=sample_low_inventory(),
        order=sample_paid_order(),
        trigger_type="INVENTORY_REVIEW",
    )
    # 动态路由：仅库存 + 履约，跳过商品规划与图片创意
    assert [run.agent_name for run in result.agent_runs] == [
        "SUPERVISOR_AGENT",
        "INVENTORY_PURCHASE_AGENT",
        "ORDER_FULFILLMENT_AGENT",
    ]
    assert result.product_plan is None
    assert result.image_plan is None
    assert result.inventory_plan is not None
    assert result.fulfillment_plan is not None


class _FlakyClient:
    """前 fail_times 次调用抛异常，其后正常返回（模拟瞬时 LLM 失败 + 重试成功）。"""

    def __init__(self, factory, fail_times=1):
        self._factory = factory
        self._fail_times = fail_times
        self.calls = 0

    def generate(self, system_prompt, user_prompt, schema):
        self.calls += 1
        if self.calls <= self._fail_times:
            raise RuntimeError("transient LLM failure")
        return self._factory(system_prompt, user_prompt, schema)


class _AlwaysFailClient:
    def generate(self, system_prompt, user_prompt, schema):
        raise RuntimeError("LLM down")


def _stub_factory(system, user, schema):
    if schema is ProductPlan:
        return ProductPlan(
            recommended_title="stub-title",
            selling_points=["a", "b", "c"],
            detail_description="d",
            target_user_summary="t",
            listing_suggestion="l",
            seo_keywords=["k"],
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


def test_supervisor_retries_transient_llm_failure(monkeypatch):
    client = _FlakyClient(_stub_factory, fail_times=1)
    monkeypatch.setattr(llm_client, "get_llm_client", lambda: client)

    result = SupervisorAgent().run(
        product=sample_product(),
        inventory=sample_low_inventory(),
        order=sample_paid_order(),
        trigger_type="GENERATE_OPERATION_PLAN",
    )
    # 重试成功后应无错误记录，且使用 LLM（stub）输出
    assert result.errors == []
    assert result.product_plan.recommended_title == "stub-title"
    assert client.calls >= 2  # 至少一次失败 + 一次重试
    assert all(run.status == "SUCCESS" for run in result.agent_runs if run.agent_name != "SUPERVISOR_AGENT")


def test_supervisor_raises_config_error_when_vendor_misconfigured(monkeypatch):
    def boom():
        raise ConfigError("LLM 已选择厂家「dashscope」但未填写 API Key（测试）")

    monkeypatch.setattr(llm_client, "get_llm_client", boom)

    # 配置缺失（未填 Key 的云端厂家）必须如实抛错，不降级到规则实现。
    with pytest.raises(ConfigError):
        SupervisorAgent().run(
            product=sample_product(),
            inventory=sample_low_inventory(),
            order=sample_paid_order(),
            trigger_type="GENERATE_OPERATION_PLAN",
        )
