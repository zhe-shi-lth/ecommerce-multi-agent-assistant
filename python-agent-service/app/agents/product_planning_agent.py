from app.schemas.agent_outputs import ProductPlan
from app.schemas.product import ProductContext


class ProductPlanningAgent:
    def run(self, product: ProductContext) -> ProductPlan:
        audience = product.target_audience or "目标用户"
        scenario = product.usage_scenario or "日常使用场景"
        selling_points = [
            f"适合{audience}使用",
            f"覆盖{scenario}等场景",
            f"{product.category}类目下具备清晰卖点",
        ]

        return ProductPlan(
            recommended_title=f"{product.name} {scenario}适用{product.category}好物",
            selling_points=selling_points,
            detail_description=f"{product.description}，适合{audience}在{scenario}中使用。",
            target_user_summary=f"目标用户为{audience}。",
            listing_suggestion="建议突出核心使用场景、价格优势和便捷体验。",
        )
