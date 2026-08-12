from fastapi.testclient import TestClient

from app.main import app


def test_operation_plan_api_returns_multi_agent_result():
    client = TestClient(app, headers={"X-Service-Key": "dev-service-key-change-me"})

    response = client.post(
        "/agent/ecommerce/operation-plan",
        json={
            "product": {
                "product_id": 1001,
                "name": "便携式榨汁杯",
                "category": "小家电",
                "description": "适合办公室和健身房使用的小型榨汁杯",
                "cost_price": 39.0,
                "sale_price": 89.0,
                "target_audience": "上班族、健身人群、学生",
                "usage_scenario": "办公室、健身房、宿舍、旅行",
                "status": "DRAFT",
            },
            "inventory": {
                "product_id": 1001,
                "current_stock": 18,
                "reserved_stock": 5,
                "safe_stock_threshold": 20,
                "purchase_cycle_days": 5,
                "sales_last_7_days": 32,
                "inventory_status": "LOW",
            },
            "order": {
                "order_id": 2001,
                "product_id": 1001,
                "quantity": 2,
                "status": "PENDING_ANALYSIS",
                "address_complete": True,
                "paid": True,
                "manual_review_required": False,
                "fulfillment_suggestion_status": "PENDING_ANALYSIS",
            },
            "trigger_type": "GENERATE_OPERATION_PLAN",
        },
    )

    assert response.status_code == 422
    assert "文本大模型" in response.json()["detail"]
