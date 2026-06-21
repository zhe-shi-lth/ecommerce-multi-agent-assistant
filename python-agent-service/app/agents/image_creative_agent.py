from app.schemas.agent_outputs import ImagePlan, ProductPlan
from app.schemas.product import ProductContext


class ImageCreativeAgent:
    def run(self, product: ProductContext, product_plan: ProductPlan) -> ImagePlan:
        selling_points = "、".join(product_plan.selling_points)
        scenario = product.usage_scenario or "日常使用场景"

        return ImagePlan(
            main_image_prompt=f"白色背景，{product.name}居中展示，突出商品外观和核心卖点。",
            scene_image_prompt=f"{scenario}场景中展示{product.name}的真实使用方式。",
            marketing_image_prompt=f"电商营销海报风格，突出{selling_points}。",
            image_style="清新明亮、生活方式、电商主图风格",
            image_risk_notes=["避免夸大功效", "避免使用侵权品牌元素"],
        )
