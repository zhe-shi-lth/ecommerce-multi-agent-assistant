"""线1（新品上架流水线，目录优先）。

与主管一次性跑 4 个 Agent 不同，线1是「用户勾选已有商品 → 文案 Agent 生成 →
用户审批 → 图片 Agent 生成 → 用户审批 → 落库上架」的顺序门控流程。

本路由只负责单步计算，不落库；审批由前端驱动，最终由 /finalize 落库。
商品在「商品 tab」已建好，这里通过商品 id 从 Java 拉真实数据喂 Agent，
不再手填想法；finalize 也不再新建商品，只把运营计划挂到已有商品上。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.rag.service import get_knowledge_service
from app.schemas.agent_outputs import ImagePlan, ProductPlan
from app.schemas.product import ProductContext
from app.tools.java_api_client import JavaApiClient

router = APIRouter(prefix="/agent/ecommerce", tags=["line1-onboarding"])


class Line1ProductRef(BaseModel):
    """勾选的已有商品 + 选中的目标平台（如 ["xiaohongshu"]）。"""

    product_id: int
    platforms: list[str] = Field(default_factory=lambda: ["xiaohongshu"])


class Line1ImageRequest(BaseModel):
    product_id: int
    platforms: list[str] = Field(default_factory=lambda: ["xiaohongshu"])
    product_plan: ProductPlan
    # 可选：用户上传的参考图（base64 data URL）。提供则走图生图，否则走文生图。
    reference_image: str | None = None


class Line1FinalizeRequest(BaseModel):
    product_id: int
    platforms: list[str] = Field(default_factory=lambda: ["xiaohongshu"])
    product_plan: ProductPlan
    image_plan: ImagePlan


def _product_context_from_java(product_id: int) -> ProductContext | None:
    """从 Java 拉真实商品，组装成 Agent 用的 ProductContext。"""
    data = JavaApiClient().get_product(product_id)
    if data is None:
        return None
    return ProductContext(
        product_id=data["id"],
        name=data["name"],
        category=data["category"],
        description=data["description"],
        cost_price=float(data.get("costPrice") or 0),
        sale_price=float(data.get("salePrice") or 0),
        target_audience=data.get("targetAudience"),
        usage_scenario=data.get("usageScenario"),
        status=data.get("status", "DRAFT"),
    )


@router.post("/line1/product-plan")
def line1_product_plan(req: Line1ProductRef) -> ProductPlan:
    product = _product_context_from_java(req.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="商品不存在或 Java 服务不可用")
    knowledge = get_knowledge_service().retrieve_for_product(product)
    agent = ProductPlanningAgent()
    try:
        return agent.run(product, knowledge, selected_platforms=req.platforms)
    except Exception:  # noqa: BLE001
        # LLM 不可用/解析失败：降级规则实现，保证目录优先上架链路不 500
        return agent._rule_based_run(product, knowledge, req.platforms)


@router.post("/line1/image-plan")
def line1_image_plan(req: Line1ImageRequest) -> ImagePlan:
    product = _product_context_from_java(req.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="商品不存在或 Java 服务不可用")
    knowledge = get_knowledge_service().retrieve_for_product(product)
    agent = ImageCreativeAgent()
    try:
        return agent.run(
            product,
            req.product_plan,
            knowledge,
            reference_image=req.reference_image,
        )
    except Exception:  # noqa: BLE001
        # LLM 不可用/解析失败：降级规则实现，保证目录优先上架链路不 500
        return agent._rule_based_run(
            product, req.product_plan, knowledge, reference_image=req.reference_image
        )


@router.post("/line1/finalize")
def line1_finalize(req: Line1FinalizeRequest) -> dict:
    """落库：商品已存在（目录优先），只建一条仅含文案+图片创意的运营计划。"""
    client = JavaApiClient()
    final_summary = (
        f"线1上架：{req.product_plan.recommended_title}；"
        f"图片风格：{req.image_plan.image_style}。"
    )
    op_id = client.persist_line1_plan(
        product_id=req.product_id,
        product_plan=req.product_plan.model_dump(),
        image_plan=req.image_plan.model_dump(),
        final_summary=final_summary,
    )
    return {
        "ok": op_id is not None,
        "productId": req.product_id,
        "operationPlanId": op_id,
    }
