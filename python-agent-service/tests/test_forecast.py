from app.agents.forecast import compute_forecast
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.llm import client as llm_client
from app.llm.client import StubClient
from app.schemas.agent_outputs import InventoryPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


def _inv(current_stock, reserved=0, threshold=20, cycle=5, sales=32, status="LOW"):
    return InventoryContext(
        product_id=1001,
        current_stock=current_stock,
        reserved_stock=reserved,
        safe_stock_threshold=threshold,
        purchase_cycle_days=cycle,
        sales_last_7_days=sales,
        inventory_status=status,
    )


def _order(quantity=2):
    return OrderContext(
        order_id=2001,
        product_id=1001,
        quantity=quantity,
        status="PENDING_ANALYSIS",
        address_complete=True,
        paid=True,
        manual_review_required=False,
        fulfillment_suggestion_status="PENDING_ANALYSIS",
    )


def test_compute_forecast_low_stock_flags_risk():
    f = compute_forecast(_inv(current_stock=18, reserved=5), _order(quantity=2))
    assert f.inventory_status == "RISK"
    assert f.restock_priority == "HIGH"
    assert f.should_restock is True
    assert f.suggested_restock_quantity > 0
    # 扣减后预计库存 11 < 阈值 20，日均需求 32/7≈4.57，约 2 天售罄 <= 采购周期 5
    assert f.days_to_stockout == 2
    assert f.projected_stock == 11


def test_compute_forecast_enough_no_restock():
    f = compute_forecast(_inv(current_stock=500, sales=70), _order(quantity=2))
    assert f.inventory_status == "ENOUGH"
    assert f.should_restock is False
    assert f.suggested_restock_quantity == 0


def test_compute_forecast_zero_sales_never_stockout():
    f = compute_forecast(_inv(current_stock=10, sales=0), _order(quantity=2))
    assert f.days_to_stockout is None
    # 无需求但库存低于阈值仍建议补货
    assert f.should_restock is True


def test_rule_based_run_carries_forecast_fields():
    plan = InventoryPurchaseAgent().run(_inv(current_stock=18, reserved=5), _order(quantity=2))
    assert plan.inventory_status == "RISK"
    assert plan.daily_demand == 32 / 7
    assert plan.projected_stock == 11
    assert plan.days_to_stockout == 2
    assert plan.available_stock == 13
    assert plan.purchase_cycle_days == 5


def test_llm_path_merges_authoritative_forecast(monkeypatch):
    def factory(system, user, schema):
        if schema is InventoryPlan:
            # stub 不提供预测字段，验证 run() 用确定性预测覆盖
            return InventoryPlan(
                inventory_status="ENOUGH",  # 故意与真实预测不同
                should_restock=False,
                suggested_restock_quantity=0,
                restock_priority="LOW",
                reason="stub",
            )
        raise AssertionError(f"unexpected schema {schema}")

    monkeypatch.setattr(llm_client, "get_llm_client", lambda: StubClient(factory))
    plan = InventoryPurchaseAgent().run(_inv(current_stock=18, reserved=5), _order(quantity=2))
    # 权威预测字段必须来自 compute_forecast，而非 stub 的臆造值
    assert plan.inventory_status == "RISK"
    assert plan.daily_demand == 32 / 7
    assert plan.days_to_stockout == 2
