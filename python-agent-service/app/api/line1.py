"""线1（新品上架流水线，目录优先）。

与主管一次性跑 4 个 Agent 不同，线1是「用户勾选已有商品 → 出图 Agent 生成（图生图/文生图）
→ 用户审批 → 文案 Agent 生成（文生文）→ 用户审批 → 落库上架」的顺序门控流程。

本路由只负责单步计算，不落库；审批由前端驱动，最终由 /finalize 落库。
商品在「商品 tab」已建好，这里通过商品 id 从 Java 拉真实数据喂 Agent，
不再手填想法；finalize 也不再新建商品，只把运营计划挂到已有商品上。

出图（image-plan）先于文案（product-plan）：图片依据商品信息 + 商家备注（+ 可选商品图做图生图）
生成，不依赖文案；文案（文生文）随后依据商品信息 + 商家备注生成。两者相互独立。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.image_creative_agent import ImageCreativeAgent
from app.agents.product_planning_agent import ProductPlanningAgent
from app.llm import client as llm_client
from app.rag.service import get_knowledge_service
from app.schemas.agent_outputs import ContentBrief, ImagePlan, ProductPlan
from app.schemas.product import ProductContext
from app.tools.java_api_client import JavaApiClient

router = APIRouter(prefix="/agent/ecommerce", tags=["line1-onboarding"])


class Line1ProductRef(BaseModel):
    """勾选的已有商品 + 选中的目标平台（如 ["xiaohongshu"]）。

    notes：商家备注（可选），与商品已有 description 合并作为写文案的额外信息。
    """

    product_id: int
    platforms: list[str] = Field(default_factory=lambda: ["xiaohongshu"])
    notes: str = ""
    content_brief: ContentBrief | None = None
    copy_requirements: str = ""


class Line1ImageRequest(BaseModel):
    product_id: int
    platforms: list[str] = Field(default_factory=lambda: ["xiaohongshu"])
    # 用户上传的商品图（base64 data URL）；提供则走图生图（照片为底图 + 备注为修改目标），
    # 不提供则走文生图（仅按商品信息 + 备注）。
    reference_image: str | None = None
    # 商家备注（可选），与商品已有 description 合并作为出图的风格/场景/卖点要求。
    notes: str = ""
    content_brief: ContentBrief | None = None
    image_requirements: str = ""


class Line1ContentBriefRequest(BaseModel):
    product_id: int
    platforms: list[str] = Field(default_factory=lambda: ["xiaohongshu"])
    merchant_brief: str = ""


class Line1FinalizeRequest(BaseModel):
    product_id: int
    platform: str = "xiaohongshu"
    content_brief: ContentBrief | None = None
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


def _rule_content_brief(product: ProductContext, merchant_brief: str) -> ContentBrief:
    audience = product.target_audience or "目标用户"
    scenario = product.usage_scenario or "日常使用场景"
    return ContentBrief(
        target_audience=audience,
        core_selling_points=[
            f"适合{audience}",
            f"覆盖{scenario}",
            f"突出{product.category}类目的实用价值",
        ],
        tone="真实、具体、不过度营销",
        visual_direction=f"围绕{scenario}做自然光生活方式画面，清楚展示{product.name}",
        video_direction=f"用短视频先呈现{scenario}痛点，再展示{product.name}的核心卖点",
        copy_direction="用种草式表达说明使用场景、核心卖点和购买理由",
        compliance_notes=["避免绝对化用语", "不夸大功效", "不使用侵权品牌元素"],
        merchant_brief=merchant_brief,
    )


@router.post("/line1/content-brief")
def line1_content_brief(req: Line1ContentBriefRequest) -> ContentBrief:
    product = _product_context_from_java(req.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="商品不存在或 Java 服务不可用")
    client = llm_client.get_llm_client()
    if client is None:
        return _rule_content_brief(product, req.merchant_brief)
    system_prompt = (
        "你是电商新品上架策略专家。请根据商品、目标平台和商家通用要求，"
        "生成一份供图片、视频、文案共同使用的 ContentBrief。"
        "要求具体、可执行、合规，不要编造商品事实。"
    )
    user_prompt = (
        f"商品上下文：\n{product.model_dump_json(indent=2)}\n\n"
        f"目标平台：{', '.join(req.platforms)}\n\n"
        f"商家通用要求：{req.merchant_brief or '无'}\n"
    )
    return client.generate(system_prompt, user_prompt, ContentBrief)


@router.post("/line1/product-plan")
def line1_product_plan(req: Line1ProductRef) -> ProductPlan:
    product = _product_context_from_java(req.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="商品不存在或 Java 服务不可用")
    knowledge = get_knowledge_service().retrieve_for_product(product)
    agent = ProductPlanningAgent()
    # 不再吞掉异常：配置缺失/厂家不支持/调用失败由 ConfigError 处理器统一返回 422 报错。
    return agent.run(
        product,
        knowledge,
        selected_platforms=req.platforms,
        notes=req.notes,
        content_brief=req.content_brief,
        copy_requirements=req.copy_requirements,
    )


@router.post("/line1/image-plan")
def line1_image_plan(req: Line1ImageRequest) -> ImagePlan:
    product = _product_context_from_java(req.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="商品不存在或 Java 服务不可用")
    knowledge = get_knowledge_service().retrieve_for_product(product)
    agent = ImageCreativeAgent()
    # 不再吞掉异常：配置缺失/厂家不支持/调用失败由 ConfigError 处理器统一返回 422 报错。
    return agent.run(
        product,
        knowledge,
        req.platforms,
        req.reference_image,
        req.notes,
        req.content_brief,
        req.image_requirements,
    )


@router.post("/line1/finalize")
def line1_finalize(req: Line1FinalizeRequest) -> dict:
    """落库：商品已存在（目录优先），只建一条仅含文案+图片创意的运营计划。

    注意：finalize 不再自动发布商品。发布是唯一的闸门——
    由「运营计划详情页 → 同意」触发线2 确定性审核(库存是否充足)，
    审核通过才将该商品标记为 PUBLISHED。
    """
    client = JavaApiClient()
    final_summary = (
        f"线1上架：{req.product_plan.recommended_title}；"
        f"图片风格：{req.image_plan.image_style}。"
    )
    product_plan = req.product_plan.model_copy(update={"content_brief": req.content_brief})
    image_plan = req.image_plan.model_copy(update={"content_brief": req.content_brief})
    op_id = client.persist_line1_plan(
        product_id=req.product_id,
        product_plan=product_plan.model_dump(),
        image_plan=image_plan.model_dump(),
        final_summary=final_summary,
        platform=req.platform,
    )
    return {
        "ok": op_id is not None,
        "productId": req.product_id,
        "operationPlanId": op_id,
    }
