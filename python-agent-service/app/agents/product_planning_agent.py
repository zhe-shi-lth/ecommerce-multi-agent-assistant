from app.llm import client as llm_client
from app.schemas.agent_outputs import ProductPlan
from app.schemas.product import ProductContext

_SYSTEM_PROMPT = (
    "你是一名电商超级个体的商品运营规划专家。"
    "根据商品上下文，输出商品标题、卖点、详情描述、目标用户小结、上架建议，"
    "以及面向搜索与多平台的运营内容：\n"
    "- seo_keywords：可被搜索引擎收录的核心关键词列表（3-6 个）。\n"
    "- meta_description：用于搜索结果/详情页摘要的精简描述（30-80 字）。\n"
    "- platform_copies：分别给出淘宝、抖音、小红书三个平台的适配文案"
    "（键为 taobao / douyin / xiaohongshu），突出各平台调性（淘宝重转化、抖音重短视频种草、小红书重笔记种草）。\n"
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
            "请按 ProductPlan 的结构化字段输出，包含 seo_keywords、meta_description、platform_copies。"
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
        seo_keywords = [
            product.name,
            product.category,
            f"{product.name}{scenario}",
            audience,
        ]
        meta_description = (
            f"{product.name}：{product.description}，适合{audience}在{scenario}中使用，"
            f"主打{selling_points[0]}。"
        )
        platform_copies = {
            "taobao": f"【{product.name}】{scenario}必备，{selling_points[0]}，限时优惠。",
            "douyin": f"短视频种草｜{product.name}：{scenario}里的小确幸，{selling_points[1]}。",
            "xiaohongshu": f"笔记分享｜入手{product.name}后，{scenario}幸福感拉满，{selling_points[2]}。",
        }

        return ProductPlan(
            recommended_title=f"{product.name} {scenario}适用{product.category}好物",
            selling_points=selling_points,
            detail_description=f"{product.description}，适合{audience}在{scenario}中使用。",
            target_user_summary=f"目标用户为{audience}。",
            listing_suggestion="建议突出核心使用场景、价格优势和便捷体验。",
            seo_keywords=seo_keywords,
            meta_description=meta_description,
            platform_copies=platform_copies,
        )
