from app.llm import client as llm_client
from app.schemas.agent_outputs import ProductPlan
from app.schemas.product import ProductContext

_SYSTEM_PROMPT = (
    "你是一名电商超级个体的商品运营规划专家。"
    "根据商品上下文，输出商品标题、卖点、详情描述、目标用户小结与上架建议。"
    "使用简体中文，内容具体、可执行，不要编造与上下文无关的信息。"
)


class ProductPlanningAgent:
    def run(self, product: ProductContext) -> ProductPlan:
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(product)
        user_prompt = (
            "商品上下文（JSON）：\n"
            f"{product.model_dump_json(indent=2)}\n\n"
            "请按 ProductPlan 的结构化字段输出。"
        )
        return client.generate(_SYSTEM_PROMPT, user_prompt, ProductPlan)

    def _rule_based_run(self, product: ProductContext) -> ProductPlan:
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
