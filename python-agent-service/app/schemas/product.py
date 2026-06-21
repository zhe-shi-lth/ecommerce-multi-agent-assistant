from pydantic import BaseModel, Field


class ProductContext(BaseModel):
    product_id: int
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    description: str = Field(min_length=1)
    cost_price: float = Field(ge=0)
    sale_price: float = Field(ge=0)
    target_audience: str | None = None
    usage_scenario: str | None = None
    status: str
