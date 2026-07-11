from pydantic import BaseModel, Field


class ProductPlan(BaseModel):
    recommended_title: str = Field(min_length=1)
    selling_points: list[str]
    detail_description: str = Field(min_length=1)
    target_user_summary: str = Field(min_length=1)
    listing_suggestion: str = Field(min_length=1)
    seo_keywords: list[str] = Field(min_length=1)
    meta_description: str = Field(min_length=1)
    platform_copies: dict[str, str] = Field(min_length=1)


class ImageReviewResult(BaseModel):
    """图片创意方案的合规/质量审核结果（本地 LLM 或规则启发式产出）。"""

    overall_score: int = Field(ge=0, le=100)  # 综合合规/质量评分 0-100
    risk_level: str  # 低风险 / 中风险 / 高风险
    issues: list[str] = []  # 发现的问题点
    suggestions: list[str] = []  # 修改建议
    reviewer: str = "rule"  # llm / rule


class ImagePlan(BaseModel):
    main_image_prompt: str = Field(min_length=1)
    scene_image_prompt: str = Field(min_length=1)
    marketing_image_prompt: str = Field(min_length=1)
    image_style: str = Field(min_length=1)
    image_risk_notes: list[str]
    image_review_result: ImageReviewResult | None = None  # 视觉审核结果（可选）


class InventoryPlan(BaseModel):
    inventory_status: str
    should_restock: bool
    suggested_restock_quantity: int = Field(ge=0)
    restock_priority: str
    reason: str = Field(min_length=1)


class FulfillmentPlan(BaseModel):
    can_ship: bool
    fulfillment_status: str
    risk_flags: list[str]
    manual_review_required: bool
    next_order_status: str
