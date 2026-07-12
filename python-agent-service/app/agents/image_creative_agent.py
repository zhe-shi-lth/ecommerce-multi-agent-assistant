import os

from dotenv import load_dotenv

from app import config
from app.llm import client as llm_client
from app.schemas.agent_outputs import ImagePlan, ImageReviewResult, ProductPlan
from app.schemas.product import ProductContext

_SYSTEM_PROMPT = (
    "你是一名电商视觉创意专家。根据商品信息与已规划的商品卖点，"
    "输出主图、场景图、营销图的文生图提示词，以及整体图片风格与合规风险提醒。"
    "使用简体中文，提示词具体、可被文生图模型直接使用，不要包含侵权品牌元素。"
)

# 视觉审核提示词：以「审核员」身份独立评估图片创意方案的合规与质量
_REVIEW_SYSTEM_PROMPT = (
    "你是一名电商图片合规审核专家。请根据商品信息与图片创意方案，"
    "评估其合规与质量风险，重点关注：\n"
    "1) 是否夸大功效、虚假宣传；\n"
    "2) 是否包含侵权品牌元素或未经授权的 logo/代言；\n"
    "3) 是否触及平台违禁词或违规表述；\n"
    "4) 提示词是否具体、可被文生图模型直接使用。\n"
    "输出 overall_score（0-100，合规且质量高则高）、risk_level（低风险/中风险/高风险）、"
    "issues（问题点列表）、suggestions（修改建议列表）。使用简体中文。"
)

# 知识库内容注入模板（审核时同样参考违禁词）
_KNOWLEDGE_APPEND = (
    "\n\n【分类知识库参考】\n{}\n"
    "请在图片创意与合规提醒中参考其中的平台规则与违禁词清单。"
)

_REVIEW_APPEND = (
    "\n\n【分类知识库参考（违禁词/平台规则）】\n{}\n"
    "请结合材料审查是否触及违禁词或平台违规表述。"
)


def _build_knowledge_block(knowledge: str, template: str) -> str:
    return template.format(knowledge) if knowledge else ""


class ImageCreativeAgent:
    def run(
        self,
        product: ProductContext,
        product_plan: ProductPlan,
        knowledge: str = "",
        reference_image: str | None = None,
    ) -> ImagePlan:
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(product, product_plan, knowledge, reference_image)
        user_prompt = (
            "商品上下文（JSON）：\n"
            f"{product.model_dump_json(indent=2)}\n\n"
            "商品规划（JSON）：\n"
            f"{product_plan.model_dump_json(indent=2)}\n\n"
            "请按 ImagePlan 的结构化字段输出图片创意方案。"
        )
        if knowledge:
            user_prompt += _KNOWLEDGE_APPEND.format(knowledge)
        image_plan = client.generate(_SYSTEM_PROMPT, user_prompt, ImagePlan)
        review = self._review_with_llm(client, product, image_plan, knowledge)
        image_plan = image_plan.model_copy(update={"image_review_result": review})
        return self._attach_generated_images(image_plan, reference_image)

    def _rule_based_run(
        self,
        product: ProductContext,
        product_plan: ProductPlan,
        knowledge: str = "",
        reference_image: str | None = None,
    ) -> ImagePlan:
        selling_points = "、".join(product_plan.selling_points)
        scenario = product.usage_scenario or "日常使用场景"

        risk_notes = ["避免夸大功效", "避免使用侵权品牌元素"]
        if knowledge:
            risk_notes.append("参考知识库违禁词清单，规避平台违规词")

        image_plan = ImagePlan(
            main_image_prompt=f"白色背景，{product.name}居中展示，突出商品外观和核心卖点。",
            scene_image_prompt=f"{scenario}场景中展示{product.name}的真实使用方式。",
            marketing_image_prompt=f"电商营销海报风格，突出{selling_points}。",
            image_style="清新明亮、生活方式、电商主图风格",
            image_risk_notes=risk_notes,
        )
        review = self._review_rule_based(image_plan, knowledge)
        image_plan = image_plan.model_copy(update={"image_review_result": review})
        return self._attach_generated_images(image_plan, reference_image)

    def _attach_generated_images(
        self, image_plan: ImagePlan, reference_image: str | None = None
    ) -> ImagePlan:
        """为三张提示词生成真实图片并回填 URL。

        - 有 reference_image（用户上传的参考图）→ 走图生图（wan2.7-image），以该图作为三张图的参考；
        - 无 reference_image → 走文生图（wanx-v1）。

        逐张顺序生成（万相 SDK 并发调用不稳定，易触发限流/偶发失败），每张失败重试 1 次；
        任一张失败仅该张回退占位，不阻断整体图片创意与后续上架。
        """
        # 请求时重新读取开关（fastapi reload 不监听 .env，避免启动期默认值被固化）。
        load_dotenv(override=True)
        enabled = config._as_bool(os.getenv("IMAGE_GEN_ENABLED"), config.IMAGE_GEN_ENABLED)
        if not enabled:
            return image_plan
        try:
            from app.tools.dashscope_image import generate_image, generate_image_from_reference
        except Exception as e:  # noqa: BLE001
            print(f"[image] 文生图不可用，降级占位：{e}")
            return image_plan

        mapping = {
            "main_image_url": image_plan.main_image_prompt,
            "scene_image_url": image_plan.scene_image_prompt,
            "marketing_image_url": image_plan.marketing_image_prompt,
        }
        urls: dict[str, str | None] = {}
        for key, prompt in mapping.items():
            if reference_image:
                urls[key] = self._generate_one(
                    generate_image_from_reference, reference_image, prompt
                )
            else:
                urls[key] = self._generate_one(generate_image, prompt)
        return image_plan.model_copy(update=urls)

    @staticmethod
    def _generate_one(callable_fn, *args, retries: int = 1) -> str | None:
        delay = 2.0
        for attempt in range(retries + 1):
            try:
                result = callable_fn(*args)
                return result[0] if result else None
            except Exception as e:  # noqa: BLE001
                if attempt < retries:
                    print(f"[image] 单图生成重试（第{attempt + 1}次）：{e}")
                    import time

                    time.sleep(delay)
                    delay *= 2
                else:
                    print(f"[image] 单图生成失败，跳过：{e}")
                    return None
        return None

    def _review_with_llm(
        self, client, product: ProductContext, image_plan: ImagePlan, knowledge: str = ""
    ) -> ImageReviewResult | None:
        """用本地 LLM 独立审核图片创意方案；失败软降级为 None（不丢创意方案）。"""
        if not config.IMAGE_REVIEW_ENABLED:
            return None
        try:
            prompt = (
                "商品上下文（JSON）：\n"
                f"{product.model_dump_json(indent=2)}\n\n"
                "图片创意方案（JSON）：\n"
                f"{image_plan.model_dump_json(indent=2)}\n\n"
                "请按 ImageReviewResult 的结构化字段输出审核结果。"
            )
            prompt += _build_knowledge_block(knowledge, _REVIEW_APPEND)
            result = client.generate(_REVIEW_SYSTEM_PROMPT, prompt, ImageReviewResult)
            return result.model_copy(update={"reviewer": "llm"})
        except Exception:  # noqa: BLE001
            return None

    def _review_rule_based(self, image_plan: ImagePlan, knowledge: str = "") -> ImageReviewResult | None:
        """确定性启发式审核：基于规则风险提示做映射，无 LLM 也可用。"""
        if not config.IMAGE_REVIEW_ENABLED:
            return None
        has_risk = bool(image_plan.image_risk_notes)
        suggestions = ["对照知识库平台规则复核", "确认无夸大功效与侵权品牌元素"]
        if knowledge:
            suggestions.append("已参考分类知识库违禁词清单")
        return ImageReviewResult(
            overall_score=70 if has_risk else 85,
            risk_level="中风险" if has_risk else "低风险",
            issues=list(image_plan.image_risk_notes),
            suggestions=suggestions,
            reviewer="rule",
        )
