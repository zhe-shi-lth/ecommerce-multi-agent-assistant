from app.llm import client as llm_client
from app.schemas.agent_outputs import ImagePlan, ProductPlan
from app.schemas.product import ProductContext

_SYSTEM_PROMPT = (
    "你是一名电商视觉创意专家。根据商品信息与已规划的商品卖点，"
    "输出主图、场景图、营销图的文生图提示词，以及整体图片风格与合规风险提醒。"
    "使用简体中文，提示词具体、可被文生图模型直接使用，不要包含侵权品牌元素。"
)

# 知识库内容注入模板
_KNOWLEDGE_APPEND = (
    "\n\n【分类知识库参考】\n{}\n"
    "请在图片创意与合规提醒中参考其中的平台规则与违禁词清单。"
)


class ImageCreativeAgent:
    def run(self, product: ProductContext, product_plan: ProductPlan, knowledge: str = "") -> ImagePlan:
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(product, product_plan, knowledge)
        user_prompt = (
            "商品上下文（JSON）：\n"
            f"{product.model_dump_json(indent=2)}\n\n"
            "商品规划（JSON）：\n"
            f"{product_plan.model_dump_json(indent=2)}\n\n"
            "请按 ImagePlan 的结构化字段输出图片创意方案。"
        )
        if knowledge:
            user_prompt += _KNOWLEDGE_APPEND.format(knowledge)
        return client.generate(_SYSTEM_PROMPT, user_prompt, ImagePlan)

    def _rule_based_run(self, product: ProductContext, product_plan: ProductPlan, knowledge: str = "") -> ImagePlan:
        selling_points = "、".join(product_plan.selling_points)
        scenario = product.usage_scenario or "日常使用场景"

        risk_notes = ["避免夸大功效", "避免使用侵权品牌元素"]
        if knowledge:
            risk_notes.append("参考知识库违禁词清单，规避平台违规词")

        return ImagePlan(
            main_image_prompt=f"白色背景，{product.name}居中展示，突出商品外观和核心卖点。",
            scene_image_prompt=f"{scenario}场景中展示{product.name}的真实使用方式。",
            marketing_image_prompt=f"电商营销海报风格，突出{selling_points}。",
            image_style="清新明亮、生活方式、电商主图风格",
            image_risk_notes=risk_notes,
        )
