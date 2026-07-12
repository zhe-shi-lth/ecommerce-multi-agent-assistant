"""线1（新品上架流水线）编排接口。

与主管一次性跑 4 个 Agent 不同，线1是「用户自由输入想法 → 文案 Agent 生成 →
用户审批 → 图片 Agent 生成 → 用户审批 → 落库上架」的顺序门控流程。

本路由只负责单步计算，不落库；审批由前端驱动，最终由 /finalize 落库。
"""

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.rag.service import get_knowledge_service
from app.schemas.agent_outputs import ImagePlan, ProductPlan
from app.schemas.product import ProductContext
from app.tools.java_api_client import JavaApiClient

router = APIRouter(prefix="/agent/ecommerce", tags=["line1-onboarding"])


class NewProductIdea(BaseModel):
    """用户自由输入的「想卖什么」原始想法，不经数据库商品表。

    Note: 前端用 camelCase 发送 targetAudience / usageScenario，这里用别名
    接收，否则 Pydantic 会忽略这两个字段 -> target_audience 为 None ->
    JavaApiClient 发 null 给 Java -> 触发 products 表 NOT NULL 约束 500。
    """

    model_config = ConfigDict(populate_by_name=True)

    name: str
    category: str
    description: str
    target_audience: str | None = Field(default=None, alias="targetAudience")
    usage_scenario: str | None = Field(default=None, alias="usageScenario")


class Line1ImageRequest(BaseModel):
    idea: NewProductIdea
    product_plan: ProductPlan


class Line1FinalizeRequest(BaseModel):
    idea: NewProductIdea
    product_plan: ProductPlan
    image_plan: ImagePlan


def _idea_to_context(idea: NewProductIdea) -> ProductContext:
    return ProductContext(
        product_id=0,  # 尚未落库，仅用于驱动 Agent
        name=idea.name,
        category=idea.category,
        description=idea.description,
        cost_price=0.0,
        sale_price=0.0,
        target_audience=idea.target_audience,
        usage_scenario=idea.usage_scenario,
        status="DRAFT",
    )


@router.post("/line1/product-plan")
def line1_product_plan(idea: NewProductIdea) -> ProductPlan:
    product = _idea_to_context(idea)
    knowledge = get_knowledge_service().retrieve_for_product(product)
    return ProductPlanningAgent().run(product, knowledge)


@router.post("/line1/image-plan")
def line1_image_plan(req: Line1ImageRequest) -> ImagePlan:
    product = _idea_to_context(req.idea)
    knowledge = get_knowledge_service().retrieve_for_product(product)
    return ImageCreativeAgent().run(product, req.product_plan, knowledge)


@router.post("/line1/finalize")
def line1_finalize(req: Line1FinalizeRequest) -> dict:
    """落库：先建商品，再建仅含文案+图片创意的运营计划（无订单/线1）。"""
    client = JavaApiClient()
    product_id = client.create_product(
        name=req.idea.name,
        category=req.idea.category,
        description=req.idea.description,
        target_audience=req.idea.target_audience,
        usage_scenario=req.idea.usage_scenario,
    )
    if product_id is None:
        return {"ok": False, "error": "创建商品失败（Java 不可用？）", "productId": None, "operationPlanId": None}

    final_summary = (
        f"线1上架：{req.product_plan.recommended_title}；"
        f"图片风格：{req.image_plan.image_style}。"
    )
    op_id = client.persist_line1_plan(
        product_id=product_id,
        product_plan=req.product_plan.model_dump(),
        image_plan=req.image_plan.model_dump(),
        final_summary=final_summary,
    )
    return {
        "ok": op_id is not None,
        "productId": product_id,
        "operationPlanId": op_id,
    }
