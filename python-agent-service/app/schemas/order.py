from pydantic import BaseModel, Field


class OrderContext(BaseModel):
    order_id: int
    product_id: int
    quantity: int = Field(ge=0)
    status: str
    address_complete: bool
    paid: bool
    manual_review_required: bool
    fulfillment_suggestion_status: str
