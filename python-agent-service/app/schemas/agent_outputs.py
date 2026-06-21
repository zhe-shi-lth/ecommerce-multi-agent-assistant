from pydantic import BaseModel, Field


class ProductPlan(BaseModel):
    recommended_title: str = Field(min_length=1)
    selling_points: list[str]
    detail_description: str = Field(min_length=1)
    target_user_summary: str = Field(min_length=1)
    listing_suggestion: str = Field(min_length=1)


class ImagePlan(BaseModel):
    main_image_prompt: str = Field(min_length=1)
    scene_image_prompt: str = Field(min_length=1)
    marketing_image_prompt: str = Field(min_length=1)
    image_style: str = Field(min_length=1)
    image_risk_notes: list[str]


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
