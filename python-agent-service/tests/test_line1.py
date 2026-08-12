from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.llm.client import StubClient
from app.schemas.agent_outputs import ContentBrief, ImagePlan, ImageReviewResult, ProductPlan

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


def _fake_generate(system, user, schema):
    if schema is ContentBrief:
        return ContentBrief(target_audience="上班族", core_selling_points=["保温"], tone="真实", visual_direction="通勤场景", video_direction="使用演示", copy_direction="场景种草", compliance_notes=[])
    if schema is ProductPlan:
        return ProductPlan(recommended_title="便携保温杯", selling_points=["保温"], detail_description="通勤保温杯", target_user_summary="上班族", listing_suggestion="突出通勤", seo_keywords=["保温杯"], meta_description="便携保温杯", platform_copies={"xiaohongshu": "通勤保温杯"})
    if schema is ImagePlan:
        return ImagePlan(main_image_prompt="白底保温杯", scene_image_prompt="通勤", marketing_image_prompt="海报", image_style="真实", image_risk_notes=[])
    if schema is ImageReviewResult:
        return ImageReviewResult(overall_score=90, risk_level="低风险", issues=[], suggestions=[], reviewer="llm")
    raise AssertionError(schema)


def _client(with_llm=True):
    for p in _PATCHES:
        p.start()
    if with_llm:
        patcher = patch("app.llm.client.get_llm_client", return_value=StubClient(_fake_generate))
        patcher.start()
        _ACTIVE.append(patcher)
    return TestClient(app, headers={"X-Service-Key": "dev-service-key-change-me"})


_ACTIVE = []


def _stop():
    while _ACTIVE:
        _ACTIVE.pop().stop()
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
                json={"product_id": 10, "platforms": ["xiaohongshu"], "notes": "测试备注"},
            ).json()
            fin = client.post(
                "/agent/ecommerce/line1/finalize",
                json={
                    "product_id": 10,
                    "platform": "xiaohongshu",
                    "product_plan": pp,
                    "image_plan": ip,
                    "video_url": "/agent/media/video/test.mp4",
                    "finalize_token": "same-request",
                },
            ).json()
            # 落库成功，且 productId 沿用已有商品（不再建新商品）
            assert fin["ok"] is True
            assert fin["productId"] == 10
            assert fin["operationPlanId"] == 99
            # finalize 只调 persist_line1_plan，不再调 create_product
            mock_persist.assert_called_once()
            # 平台应透传到落库（线1 计划归属所选平台，而非 unspecified）
            assert mock_persist.call_args.kwargs.get("platform") == "xiaohongshu"
            assert mock_persist.call_args.kwargs["image_plan"]["video_url"] == "/agent/media/video/test.mp4"
            assert mock_persist.call_args.kwargs["trace_id"] == "line1_same-request"
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


def test_line1_generation_without_llm_returns_422():
    try:
        client = _client(with_llm=False)
        resp = client.post("/agent/ecommerce/line1/content-brief", json={"product_id": 10})
        assert resp.status_code == 422
        assert "文本大模型" in resp.json()["detail"]
    finally:
        _stop()


def test_line1_finalize_persistence_failure_returns_502():
    try:
        client = _client()
        pp = _fake_generate("", "", ProductPlan).model_dump()
        ip = _fake_generate("", "", ImagePlan).model_dump()
        with patch("app.tools.java_api_client.JavaApiClient.persist_line1_plan", return_value=None):
            resp = client.post("/agent/ecommerce/line1/finalize", json={"product_id": 10, "platform": "xiaohongshu", "product_plan": pp, "image_plan": ip, "finalize_token": "failed"})
        assert resp.status_code == 502
    finally:
        _stop()
