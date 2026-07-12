from app.agents.logistics import compute_logistics_risk
from app.agents.order_fulfillment_agent import OrderFulfillmentAgent
from app.llm import client as llm_client
from app.llm.client import StubClient
from app.schemas.agent_outputs import FulfillmentPlan
from app.schemas.inventory import InventoryContext
from app.schemas.order import OrderContext


def _order(paid=True, address_complete=True, quantity=2, manual_review=False):
    return OrderContext(
        order_id=2001,
        product_id=1001,
        quantity=quantity,
        status="PENDING_ANALYSIS",
        address_complete=address_complete,
        paid=paid,
        manual_review_required=manual_review,
        fulfillment_suggestion_status="PENDING_ANALYSIS",
    )


def _inv(current_stock=100, reserved=0):
    return InventoryContext(
        product_id=1001,
        current_stock=current_stock,
        reserved_stock=reserved,
        safe_stock_threshold=20,
        purchase_cycle_days=5,
        sales_last_7_days=32,
        inventory_status="OK",
    )


def test_compute_logistics_risk_unpaid_high():
    r = compute_logistics_risk(_order(paid=False), _inv())
    assert r.logistics_risk_level == "HIGH"
    assert any("未付款" in a for a in r.anomaly_details)
    assert r.after_sale_suggested is True


def test_compute_logistics_risk_address_incomplete_high():
    r = compute_logistics_risk(_order(address_complete=False), _inv())
    assert r.logistics_risk_level == "HIGH"
    assert any("地址" in a for a in r.anomaly_details)
    assert r.after_sale_suggested is True


def test_compute_logistics_risk_insufficient_stock_high():
    r = compute_logistics_risk(_order(), _inv(current_stock=1))
    assert r.logistics_risk_level == "HIGH"
    assert any("库存" in a for a in r.anomaly_details)


def test_compute_logistics_risk_large_order_medium():
    r = compute_logistics_risk(_order(quantity=12), _inv())
    assert r.logistics_risk_level == "MEDIUM"
    assert any("分批" in a for a in r.anomaly_details)
    # 仅因量大，未到 HIGH、地址完整、无需复核 -> 不触发售后
    assert r.after_sale_suggested is False


def test_compute_logistics_risk_clean_low():
    r = compute_logistics_risk(_order(), _inv())
    assert r.logistics_risk_level == "LOW"
    assert r.anomaly_details == []
    assert r.after_sale_suggested is False


def test_compute_logistics_risk_manual_review_flags_after_sale():
    r = compute_logistics_risk(_order(manual_review=True), _inv())
    assert r.logistics_risk_level == "MEDIUM"
    assert r.after_sale_suggested is True


def test_rule_based_run_carries_logistics_fields():
    plan = OrderFulfillmentAgent().run(_order(), _inv())
    assert plan.logistics_risk_level == "LOW"
    assert plan.after_sale_suggested is False
    assert plan.can_ship is True


def test_rule_based_run_high_risk_when_unpaid():
    plan = OrderFulfillmentAgent().run(_order(paid=False), _inv())
    assert plan.logistics_risk_level == "HIGH"
    assert plan.after_sale_suggested is True
    assert plan.can_ship is False


def test_llm_path_merges_authoritative_logistics(monkeypatch):
    def factory(system, user, schema):
        if schema is FulfillmentPlan:
            # stub 故意给出与真实推算相反的低风险值，验证 run() 用确定性结论覆盖
            return FulfillmentPlan(
                can_ship=True,
                fulfillment_status="READY_TO_SHIP",
                risk_flags=[],
                manual_review_required=False,
                next_order_status="READY_TO_SHIP",
                logistics_risk_level="LOW",
                anomaly_details=[],
                suggested_actions=[],
                after_sale_suggested=False,
                after_sale_reason="",
            )
        raise AssertionError(f"unexpected schema {schema}")

    monkeypatch.setattr(llm_client, "get_llm_client", lambda: StubClient(factory))
    plan = OrderFulfillmentAgent().run(_order(paid=False), _inv())
    # 权威物流结论必须来自 compute_logistics_risk，而非 stub 的臆造值
    assert plan.logistics_risk_level == "HIGH"
    assert plan.after_sale_suggested is True
    assert any("未付款" in a for a in plan.anomaly_details)
