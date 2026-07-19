import json
import re

from app.llm import client as llm_client
from app.schemas.agent_outputs import ProductPlan
from app.schemas.product import ProductContext

# 平台键 -> 中文名（用于拼装 prompt / 规则文案）
_PLATFORM_LABELS = {
    "taobao": "淘宝",
    "douyin": "抖音",
    "xiaohongshu": "小红书",
}
_ALL_PLATFORMS = list(_PLATFORM_LABELS.keys())

_SYSTEM_PROMPT = (
    "你是一名电商超级个体的商品运营规划专家。"
    "根据商品上下文，输出商品标题、卖点、详情描述、目标用户小结、上架建议，"
    "以及面向搜索与多平台的运营内容：\n"
    "- seo_keywords：可被搜索引擎收录的核心关键词列表（3-6 个）。\n"
    "- meta_description：用于搜索结果/详情页摘要的精简描述（30-80 字）。\n"
    "- platform_copies：分别给出 {platform_names} 的适配文案"
    "（键为 {platform_keys}），突出各平台调性（淘宝重转化、抖音重短视频种草、小红书重笔记种草）。\n"
    "使用简体中文，内容具体、可执行，不要编造与上下文无关的信息。"
)

# 知识库内容注入模板：不偏离商品事实，优先采纳平台规则、违禁词规避与 SEO 建议
_KNOWLEDGE_APPEND = (
    "\n\n【分类知识库参考】\n{}\n"
    "请在不偏离商品事实的前提下，优先采纳其中的平台规则、违禁词规避与 SEO 建议。"
)


def _extract_json(text: str) -> dict:
    """从视觉模型回复中截取第一个 JSON 对象（兼容 ```json 围栏）。解析失败抛异常。"""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("视觉模型回复中未找到 JSON 对象")
    return json.loads(cleaned[start : end + 1])


def _resolve_platforms(selected: list[str] | None) -> list[str]:
    """选中平台为空/None 时，默认覆盖全部三平台。"""
    if not selected:
        return _ALL_PLATFORMS
    return [p for p in selected if p in _PLATFORM_LABELS]


class ProductPlanningAgent:
    def run(
        self,
        product: ProductContext,
        knowledge: str = "",
        selected_platforms: list[str] | None = None,
        reference_image: str | None = None,
        notes: str = "",
    ) -> ProductPlan:
        platforms = _resolve_platforms(selected_platforms)
        # 有上传商品图且已配置视觉模型 Key → 走多模态「看图 + 备注」写文案
        if reference_image and self._vision_available():
            try:
                return self._vision_run(product, knowledge, platforms, reference_image, notes)
            except Exception as e:  # noqa: BLE001
                print(f"[plan] 视觉看图写文案失败，降级规则实现：{e}")
                return self._rule_based_run(product, knowledge, platforms, notes)
        client = llm_client.get_llm_client()
        if client is None:
            return self._rule_based_run(product, knowledge, platforms, notes)
        user_prompt = (
            "商品上下文（JSON）：\n"
            f"{product.model_dump_json(indent=2)}\n\n"
            "请按 ProductPlan 的结构化字段输出，包含 seo_keywords、meta_description、platform_copies。"
        )
        if notes:
            user_prompt += f"\n\n【商家备注】\n{notes}\n请结合备注中的额外信息撰写文案。"
        if knowledge:
            user_prompt += _KNOWLEDGE_APPEND.format(knowledge)
        prompt = _SYSTEM_PROMPT.format(
            platform_names="、".join(_PLATFORM_LABELS[p] for p in platforms),
            platform_keys="/".join(platforms),
        )
        plan = client.generate(prompt, user_prompt, ProductPlan)
        # 归一化平台键：LLM 偶发把 taobao 写成 timaobao，必须落回规范键，否则前端按键取不到
        plan = plan.model_copy(
            update={
                "platform_copies": self._normalize_platform_copies(
                    plan.platform_copies, product, platforms
                )
            }
        )
        return plan

    def _vision_run(
        self,
        product: ProductContext,
        knowledge: str,
        platforms: list[str],
        reference_image: str,
        notes: str,
    ) -> ProductPlan:
        """多模态路径：把商品图 + 商品上下文 + 商家备注发给视觉模型写文案。"""
        from app.tools.dashscope_vl import vl_chat

        prompt = _SYSTEM_PROMPT.format(
            platform_names="、".join(_PLATFORM_LABELS[p] for p in platforms),
            platform_keys="/".join(platforms),
        )
        user = (
            "商品上下文（JSON）：\n"
            f"{product.model_dump_json(indent=2)}\n\n"
            f"请只看这张商品图，结合上述商品信息，按 ProductPlan 的结构化字段输出，"
            f"包含 seo_keywords、meta_description、platform_copies（键为 {'/'.join(platforms)}）。"
            "只输出 JSON，不要任何解释文字。"
        )
        if notes:
            user += f"\n\n【商家备注】\n{notes}\n请结合备注中的额外信息撰写文案。"
        if knowledge:
            user += _KNOWLEDGE_APPEND.format(knowledge)
        raw = vl_chat(prompt, user, reference_image)
        data = _extract_json(raw)
        # 视觉模型可能只回了部分字段（如仅 seo_keywords），直接 model_validate 会因
        # 必填字段缺失而失败、整段降级成规则。改为：以规则基线为底，叠加视觉模型给出的
        # 有效字段，既用上"看图"成果，又保证产出是合法的完整 ProductPlan。
        valid_fields = set(ProductPlan.model_fields.keys())
        baseline = self._rule_based_run(product, knowledge, platforms, notes).model_dump()
        for key, val in data.items():
            if key in valid_fields and val not in (None, "", [], {}):
                baseline[key] = val
        plan = ProductPlan.model_validate(baseline)
        plan = plan.model_copy(
            update={
                "platform_copies": self._normalize_platform_copies(
                    plan.platform_copies, product, platforms
                )
            }
        )
        return plan

    @staticmethod
    def _vision_available() -> bool:
        """是否已配置视觉模型 Key（足以发起「看图写文案」）。"""
        from app.settings_store import resolve_vision_credentials

        _, api_key, _ = resolve_vision_credentials()
        return bool(api_key)

    @staticmethod
    def _normalize_platform_copies(raw: dict, product: ProductContext, platforms: list[str]) -> dict:
        """把 LLM 偶发的平台键错别字（如 timaobao）归一为规范键 taobao/douyin/xiaohongshu。"""
        result: dict[str, str] = {}
        for p in platforms:
            if raw.get(p):
                result[p] = raw[p]
                continue
            # 模糊匹配：规范键是 LLM 键的子串（timaobao 含 taobao）
            hit = next((v for k, v in raw.items() if p in k.lower()), None)
            result[p] = hit or f"{product.name}（{_PLATFORM_LABELS.get(p, p)} 文案待补充）"
        return result

    def _rule_based_run(
        self,
        product: ProductContext,
        knowledge: str = "",
        platforms: list[str] | None = None,
        notes: str = "",
    ) -> ProductPlan:
        platforms = _resolve_platforms(platforms)
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
        detail_description = f"{product.description}，适合{audience}在{scenario}中使用。"

        _RULE_COPY = {
            "taobao": f"【{product.name}】{scenario}必备，{selling_points[0]}，限时优惠。",
            "douyin": f"短视频种草｜{product.name}：{scenario}里的小确幸，{selling_points[1]}。",
            "xiaohongshu": f"笔记分享｜入手{product.name}后，{scenario}幸福感拉满，{selling_points[2]}。",
        }
        platform_copies = {p: _RULE_COPY[p] for p in platforms}

        # 规则路径也采纳知识库：补充 SEO 词 + 提示规避违禁词
        if knowledge:
            seo_keywords = seo_keywords + ["知识库建议词（见知识库SEO）"]
            for key in platform_copies:
                platform_copies[key] += "（请对照知识库平台规则与违禁词自检）"

        # 商家备注（上传商品图时一并填写）：并入卖点与详情，保证落库文案带上备注信息
        if notes:
            selling_points = selling_points + [f"商家备注：{notes}"]
            detail_description += f"\n商家备注：{notes}"

        return ProductPlan(
            recommended_title=f"{product.name} {scenario}适用{product.category}好物",
            selling_points=selling_points,
            detail_description=detail_description,
            target_user_summary=f"目标用户为{audience}。",
            listing_suggestion="建议突出核心使用场景、价格优势和便捷体验。",
            seo_keywords=seo_keywords,
            meta_description=meta_description,
            platform_copies=platform_copies,
        )
