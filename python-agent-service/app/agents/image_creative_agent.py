import os
from functools import partial

from dotenv import load_dotenv

from app import config
from app.errors import ConfigError
from app.llm import client as llm_client
from app.settings_store import get_settings
from app.schemas.agent_outputs import ContentBrief, ImagePlan, ImageReviewResult
from app.schemas.product import ProductContext

_SYSTEM_PROMPT = (
    "你是一名电商视觉创意专家。根据商品信息与商家备注（若有），"
    "输出一张主图的文生图提示词（main_image_prompt），该提示词必须直接依据商品信息与备注"
    "来描述商品主图，并给出整体图片风格（image_style）与合规风险提醒"
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
        knowledge: str = "",
        platforms: list[str] | None = None,
        reference_image: str | None = None,
        notes: str = "",
        content_brief: ContentBrief | None = None,
        image_requirements: str = "",
    ) -> ImagePlan:
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(
                product, knowledge, notes, reference_image, content_brief, image_requirements
            )
        user_prompt = (
            "商品上下文（JSON）：\n"
            f"{product.model_dump_json(indent=2)}\n\n"
            "请按 ImagePlan 的结构化字段输出图片创意方案。"
        )
        if notes:
            user_prompt += (
                f"\n\n【商家备注】\n{notes}\n"
                "请结合备注中的风格 / 场景 / 卖点要求设计主图与整体视觉。"
            )
        if content_brief:
            user_prompt += (
                "\n\n【上架策略 Content Brief】\n"
                f"{content_brief.model_dump_json(indent=2)}\n"
                "请严格围绕 visual_direction 设计图片，并与视频/文案方向保持一致。"
            )
        if image_requirements:
            user_prompt += f"\n\n【图片专项要求】\n{image_requirements}\n请优先满足这些图片要求。"
        if knowledge:
            user_prompt += _KNOWLEDGE_APPEND.format(knowledge)
        image_plan = client.generate(_SYSTEM_PROMPT, user_prompt, ImagePlan)
        review = self._review_with_llm(client, product, image_plan, knowledge)
        image_plan = image_plan.model_copy(update={"image_review_result": review})
        image_plan = image_plan.model_copy(update={"content_brief": content_brief})
        image_notes = "\n".join(x for x in [notes, image_requirements] if x)
        return self._attach_generated_images(image_plan, product, platforms, reference_image, image_notes)

    def _rule_based_run(
        self,
        product: ProductContext,
        knowledge: str = "",
        notes: str = "",
        reference_image: str | None = None,
        content_brief: ContentBrief | None = None,
        image_requirements: str = "",
    ) -> ImagePlan:
        scenario = product.usage_scenario or "日常使用场景"

        risk_notes = ["避免夸大功效", "避免使用侵权品牌元素"]
        if knowledge:
            risk_notes.append("参考知识库违禁词清单，规避平台违规词")
        merged_notes = "\n".join(x for x in [notes, image_requirements] if x)
        style = (
            content_brief.visual_direction
            if content_brief
            else "清新明亮、生活方式、电商主图风格"
        )

        image_plan = ImagePlan(
            content_brief=content_brief,
            main_image_prompt=f"白色背景，{product.name}居中展示，突出商品外观和核心卖点。",
            scene_image_prompt=f"{scenario}场景中展示{product.name}的真实使用方式。",
            marketing_image_prompt=f"电商营销海报风格，突出{product.name}。",
            image_style=style,
            image_risk_notes=risk_notes,
        )
        review = self._review_rule_based(image_plan, knowledge)
        image_plan = image_plan.model_copy(update={"image_review_result": review})
        return self._attach_generated_images(image_plan, product, None, reference_image, merged_notes)

    def _build_copy_prompt(
        self,
        product: ProductContext | None,
        notes: str,
        image_plan: ImagePlan,
        platforms: list[str] | None = None,
    ) -> str:
        """根据商品信息 + 商家备注（文生文尚未生成，不依赖文案）构造单张主图的文生图提示词。

        无备注时退化为「按商品名 + 描述展示」的兜底提示词，避免出现与商品无关的随机图。
        """
        if product is None:
            return "电商主图风格，清晰展示商品，白色背景，居中构图。"

        parts: list[str] = [f"为电商商品生成一张主图：{product.name}"]
        if product.description:
            parts.append(f"商品描述：{product.description}")
        if product.category:
            parts.append(f"所属类目：{product.category}")
        if notes:
            parts.append(f"商家要求（风格 / 场景 / 卖点）：{notes}")

        parts.append(f"图片风格：{image_plan.image_style}")
        guard = "；".join(image_plan.image_risk_notes) if image_plan.image_risk_notes else ""
        guard_extra = "不要使用侵权品牌元素，不要夸大功效，避免违规表述。"
        parts.append("合规要求：" + (guard + "。" if guard else "") + guard_extra)
        return "。".join(parts)

    def _build_edit_prompt(
        self,
        product: ProductContext | None,
        notes: str,
        image_plan: ImagePlan,
        platforms: list[str] | None = None,
    ) -> str:
        """图生图专用的「修改指令」提示词：明确要求基于原图做实际修改，而非中性重绘。

        与 _build_copy_prompt（文生图用、描述目标图）不同，这里强调——保留商品主体、
        按商家备注改动背景/风格/光影/附加元素，避免模型原样返回原图。
        """
        prefix = "请基于提供的原商品图，按以下要求做实际修改（务必改变相应部分，不要原样保留）："
        if product is None:
            suffix = (
                "保持商品主体不变，仅调整背景、风格、光影与附加元素。"
                "合规：不要使用侵权品牌元素，不要夸大功效，避免违规表述。"
            )
            if notes:
                return prefix + f"修改要求：{notes}。" + suffix
            return prefix + "调整背景与整体风格，保持商品主体不变。合规：不要使用侵权品牌元素。" + suffix

        parts: list[str] = []
        if product.name:
            parts.append(f"商品：{product.name}")
        if product.description:
            parts.append(f"商品描述：{product.description}")
        if product.category:
            parts.append(f"所属类目：{product.category}")
        if notes:
            parts.append(f"修改要求：{notes}")
        parts.append(f"目标风格：{image_plan.image_style}")
        suffix = (
            "保持商品主体（款式、颜色、品类）不变，仅调整背景、风格、光影与附加元素。"
            "合规：不要使用侵权品牌元素，不要夸大功效，避免违规表述。"
        )
        return prefix + "；".join(parts) + "。" + suffix

    def _attach_generated_images(
        self,
        image_plan: ImagePlan,
        product: ProductContext | None = None,
        platforms: list[str] | None = None,
        reference_image: str | None = None,
        notes: str = "",
    ) -> ImagePlan:
        """生成**单张**主图并回填 main_image_url。

        - 传了商品图（reference_image）：走**图生图**，以照片为底图、文案为修改目标，在其基础上精修/改图。
        - 没传图：走**文生图**，仅按文案从零生成。
        提示词均由文案（标题/卖点/平台文案/风格）推导，保证图片贴合用户编辑后的文案。

        行为：
        - 离线模式（`LLM_ENABLED=false`）或出图关闭 → 跳过（不报错、不出图）。
        - 出图开启但所选厂家缺 Key/模型/端点不支持 → 抛 `ConfigError`（直接报错，不降级占位）。
        - 已配好但 API 瞬时报错 → 重试 1 次后仍失败则如实抛出。
        """
        # 请求时重新读取开关（fastapi reload 不监听 .env，避免启动期默认值被固化）。
        load_dotenv(override=True)
        image_settings = get_settings().get("image", {})
        # 离线/规则模式：显式不下外部出图，直接跳过（非报错）。
        if not config.LLM_ENABLED or not image_settings.get("enabled", True):
            return image_plan

        from app.tools.image_gen import get_image_generator

        generator = get_image_generator()  # 配置缺失直接抛 ConfigError

        ref_strength = float(image_settings.get("ref_strength", 0.4))
        if reference_image:
            # 图生图：照片为底图 + 商家备注为修改目标（用"修改指令"提示词，避免原样返回）。
            # 用 partial 以关键字传入 ref_strength：否则位置参数会把 ref_strength 误填进
            # size 形参（generate_image_edit 签名为 prompt/base_image_url/size=/n=/ref_strength=），
            # 导致 size 收到浮点数、请求非法、任务 FAILED。
            prompt = self._build_edit_prompt(product, notes, image_plan, platforms)
            main_url = self._generate_one(
                partial(generator.generate_image_edit, ref_strength=ref_strength),
                prompt, reference_image,
            )
        else:
            # 文生图：仅按商品信息 + 备注从零生成
            prompt = self._build_copy_prompt(product, notes, image_plan, platforms)
            main_url = self._generate_one(generator.generate_image, prompt)
        # 同步 main_image_prompt 为实际用于生成的文案提示词，保证展示与生成一致
        return image_plan.model_copy(update={"main_image_url": main_url, "main_image_prompt": prompt})

    @staticmethod
    def _generate_one(callable_fn, *args, retries: int = 1) -> str | None:
        """调用出图生成函数，瞬态失败重试 1 次；最终仍失败则如实抛出（不占位、不降级）。"""
        delay = 2.0
        last_exc: Exception | None = None
        for attempt in range(retries + 1):
            try:
                result = callable_fn(*args)
                return result[0] if result else None
            except Exception as e:  # noqa: BLE001
                last_exc = e
                if attempt < retries:
                    print(f"[image] 单图生成重试（第{attempt + 1}次）：{e}")
                    import time

                    time.sleep(delay)
                    delay *= 2
        # 重试耗尽仍失败：如实抛出（ConfigError 或运行时错误），由上层转成报错。
        raise last_exc if last_exc else RuntimeError("出图失败")

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
