from pydantic import BaseModel, Field


class InventoryContext(BaseModel):
    product_id: int
    current_stock: int = Field(ge=0)
    reserved_stock: int = Field(ge=0)
    safe_stock_threshold: int = Field(ge=0)
    purchase_cycle_days: int = Field(ge=0)
    sales_last_7_days: int = Field(ge=0)
    inventory_status: str
