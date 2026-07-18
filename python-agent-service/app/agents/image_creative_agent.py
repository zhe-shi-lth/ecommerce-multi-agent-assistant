import os

from dotenv import load_dotenv

from app.llm import client as llm_client
from app.settings_store import get_settings
from app.schemas.agent_outputs import ImagePlan, ImageReviewResult, ProductPlan
from app.schemas.product import ProductContext

_SYSTEM_PROMPT = (
    "你是一名电商视觉创意专家。根据商品信息与已规划的商品卖点（文案），"
    "输出一张主图的文生图提示词（main_image_prompt），该提示词必须直接依据给定文案"
    "（标题、卖点、平台文案）来描述商品主图，并给出整体图片风格（image_style）与合规风险提醒"
    "（image_risk_notes）。可补充场景图/营销图的创意建议（scene_image_prompt / "
    "marketing_image_prompt）作为参考，但主线只生成这一张主图。使用简体中文，提示词具体、"
    "可被文生图模型直接使用，不要包含侵权品牌元素。"
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
        platforms: list[str] | None = None,
        reference_image: str | None = None,
    ) -> ImagePlan:
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
        image_plan = client.generate(_SYSTEM_PROMPT, user_prompt, ImagePlan)
        review = self._review_with_llm(client, product, image_plan, knowledge)
        image_plan = image_plan.model_copy(update={"image_review_result": review})
        return self._attach_generated_images(image_plan, product, product_plan, platforms, reference_image)

    def _rule_based_run(
        self,
        product: ProductContext,
        product_plan: ProductPlan,
        knowledge: str = "",
        platforms: list[str] | None = None,
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
        return self._attach_generated_images(image_plan, product, product_plan, platforms, reference_image)

    def _build_copy_prompt(
        self,
        product: ProductContext | None,
        product_plan: ProductPlan | None,
        image_plan: ImagePlan,
        platforms: list[str] | None = None,
    ) -> str:
        """根据文案（用户编辑后的商品规划）构造单张主图的文生图提示词，确保贴合文案。

        优先采用所选平台的营销文案；无平台信息时取首个可用平台文案；完全没有文案则
        退化为「按商品名展示」的兜底提示词，避免出现与商品无关的随机图。
        """
        if product_plan is None:
            name = product.name if product else "商品"
            return f"电商主图风格，清晰展示{name}，白色背景，居中构图。"

        parts: list[str] = [f"为电商商品生成一张主图：{product_plan.recommended_title}"]
        if product_plan.selling_points:
            parts.append("核心卖点：" + "、".join(product_plan.selling_points))

        copies = product_plan.platform_copies or {}
        copy_text = ""
        if platforms:
            for p in platforms:
                if p in copies:
                    copy_text = copies[p]
                    break
        if not copy_text and copies:
            copy_text = next(iter(copies.values()))
        if copy_text:
            parts.append(f"营销文案重点：{copy_text}")
        if product_plan.detail_description:
            parts.append(f"商品详情要点：{product_plan.detail_description}")

        parts.append(f"图片风格：{image_plan.image_style}")
        guard = "；".join(image_plan.image_risk_notes) if image_plan.image_risk_notes else ""
        guard_extra = "不要使用侵权品牌元素，不要夸大功效，避免违规表述。"
        parts.append("合规要求：" + (guard + "。" if guard else "") + guard_extra)
        return "。".join(parts)

    def _build_edit_prompt(
        self,
        product: ProductContext | None,
        product_plan: ProductPlan | None,
        image_plan: ImagePlan,
        platforms: list[str] | None = None,
    ) -> str:
        """图生图专用的「修改指令」提示词：明确要求基于原图做实际修改，而非中性重绘。

        与 _build_copy_prompt（文生图用、描述目标图）不同，这里强调——保留商品主体、
        改动背景/风格/光影/附加元素，避免模型原样返回原图。
        """
        if product_plan is None:
            name = product.name if product else "商品"
            return (
                f"请基于提供的原商品图，对{name}做实际修改（务必改变相应部分，不要原样保留）："
                f"调整背景与整体风格，保持商品主体不变。合规：不要使用侵权品牌元素。"
            )
        parts: list[str] = []
        if product_plan.recommended_title:
            parts.append(f"商品：{product_plan.recommended_title}")
        if product_plan.selling_points:
            parts.append("需体现的核心卖点：" + "、".join(product_plan.selling_points))
        copies = product_plan.platform_copies or {}
        copy_text = ""
        if platforms:
            for p in platforms:
                if p in copies:
                    copy_text = copies[p]
                    break
        if not copy_text and copies:
            copy_text = next(iter(copies.values()))
        if copy_text:
            parts.append(f"文案要求：{copy_text}")
        if product_plan.detail_description:
            parts.append(f"详情要点：{product_plan.detail_description}")
        parts.append(f"目标风格：{image_plan.image_style}")
        prefix = "请基于提供的原商品图，按以下要求做实际修改（务必改变相应部分，不要原样保留）："
        suffix = (
            "保持商品主体（款式、颜色、品类）不变，仅调整背景、风格、光影与附加元素。"
            "合规：不要使用侵权品牌元素，不要夸大功效，避免违规表述。"
        )
        return prefix + "；".join(parts) + "。" + suffix

    def _attach_generated_images(
        self,
        image_plan: ImagePlan,
        product: ProductContext | None = None,
        product_plan: ProductPlan | None = None,
        platforms: list[str] | None = None,
        reference_image: str | None = None,
    ) -> ImagePlan:
        """生成**单张**主图并回填 main_image_url。

        - 传了商品图（reference_image）：走**图生图**（wanx2.1-imageedit），以照片为底图、
          文案为修改目标，在其基础上精修/改图。
        - 没传图：走**文生图**（wanx-v1），仅按文案从零生成。
        提示词均由文案（标题/卖点/平台文案/风格）推导，保证图片贴合用户编辑后的文案。
        生成失败重试 1 次，失败仅回退占位，不阻断上架。
        """
        # 请求时重新读取开关（fastapi reload 不监听 .env，避免启动期默认值被固化）。
        load_dotenv(override=True)
        image_settings = get_settings().get("image", {})
        if not image_settings.get("enabled", True):
            return image_plan
        try:
            from app.tools.dashscope_image import generate_image, generate_image_edit
        except Exception as e:  # noqa: BLE001
            print(f"[image] 文生图不可用，降级占位：{e}")
            return image_plan

        ref_strength = float(image_settings.get("ref_strength", 0.4))
        if reference_image:
            # 图生图：照片为底图 + 文案为修改目标（用"修改指令"提示词，避免原样返回）
            prompt = self._build_edit_prompt(product, product_plan, image_plan, platforms)
            main_url = self._generate_one(generate_image_edit, prompt, reference_image, ref_strength)
        else:
            # 文生图：仅按文案从零生成
            prompt = self._build_copy_prompt(product, product_plan, image_plan, platforms)
            main_url = self._generate_one(generate_image, prompt)
        # 同步 main_image_prompt 为实际用于生成的文案提示词，保证展示与生成一致
        return image_plan.model_copy(update={"main_image_url": main_url, "main_image_prompt": prompt})

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
        if not get_settings().get("image_review_enabled", True):
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
        if not get_settings().get("image_review_enabled", True):
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
