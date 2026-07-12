from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app

# 模拟「商品 tab 已建好的商品」（Java ProductResponse 的 camelCase JSON）
_FAKE_PRODUCT = {
    "id": 10,
    "name": "便携保温杯",
    "category": "家居",
    "description": "316不锈钢保温杯",
    "costPrice": 39.0,
    "salePrice": 89.0,
    "targetAudience": "上班族",
    "usageScenario": "通勤",
    "status": "DRAFT",
}

# 强制规则路径，避免测试去连真实 LLM
_PATCHES = (
    patch("app.llm.client.get_llm_client", return_value=None),
    patch("app.tools.java_api_client.JavaApiClient.get_product", return_value=_FAKE_PRODUCT),
)


def _client():
    for p in _PATCHES:
        p.start()
    return TestClient(app)


def _stop():
    for p in _PATCHES:
        p.stop()


def test_line1_product_plan_only_selected_platform():
    try:
        client = _client()
        resp = client.post(
            "/agent/ecommerce/line1/product-plan",
            json={"product_id": 10, "platforms": ["xiaohongshu"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        # 仅生成选中的平台文案
        assert set(data["platform_copies"].keys()) == {"xiaohongshu"}
    finally:
        _stop()


def test_line1_full_flow_no_product_creation():
    try:
        client = _client()
        with patch(
            "app.tools.java_api_client.JavaApiClient.persist_line1_plan", return_value=99
        ) as mock_persist:
            pp = client.post(
                "/agent/ecommerce/line1/product-plan",
                json={"product_id": 10, "platforms": ["xiaohongshu"]},
            ).json()
            ip = client.post(
                "/agent/ecommerce/line1/image-plan",
                json={"product_id": 10, "platforms": ["xiaohongshu"], "product_plan": pp},
            ).json()
            fin = client.post(
                "/agent/ecommerce/line1/finalize",
                json={
                    "product_id": 10,
                    "platforms": ["xiaohongshu"],
                    "product_plan": pp,
                    "image_plan": ip,
                },
            ).json()
            # 落库成功，且 productId 沿用已有商品（不再建新商品）
            assert fin["ok"] is True
            assert fin["productId"] == 10
            assert fin["operationPlanId"] == 99
            # finalize 只调 persist_line1_plan，不再调 create_product
            mock_persist.assert_called_once()
    finally:
        _stop()


def test_line1_product_plan_missing_product_returns_404():
    try:
        client = _client()
        with patch(
            "app.tools.java_api_client.JavaApiClient.get_product", return_value=None
        ):
            resp = client.post(
                "/agent/ecommerce/line1/product-plan",
                json={"product_id": 999, "platforms": ["xiaohongshu"]},
            )
            assert resp.status_code == 404
    finally:
        _stop()
