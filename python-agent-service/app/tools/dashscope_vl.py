"""多模态视觉模型封装：看图生成文本（OpenAI 兼容协议）。

用于「上传商品图 → 结合图片与商家备注生成文案」的多模态场景。
支持任意 OpenAI 兼容的多模态端点（通义千问 VL / GPT-4o / 智谱 GLM-4V / Kimi / Ollama 本地等），
按设置中心「视觉模型」卡片的 base_url / api_key / model 调用；未显式填写时回退默认值。

Key 只来自页面「设置中心」，不读 .env（面向最终用户，页面即唯一配置来源）。

vl_chat(system_prompt, text, image) -> str：返回视觉模型的文本回复。
无 key / 依赖缺失 / 调用失败 -> 抛异常，由调用方降级到规则实现。
"""
from app.settings_store import resolve_vision_credentials


def vl_chat(system_prompt: str, text: str, image: str, model: str | None = None) -> str:
    base_url, api_key, resolved_model = resolve_vision_credentials()
    model = model or resolved_model
    if not api_key or not base_url:
        raise RuntimeError("视觉模型未配置（需在设置中心填写 API Key 与 base_url）")

    try:
        from langchain_openai import ChatOpenAI
    except ImportError as e:  # 依赖未安装
        raise RuntimeError("langchain-openai 未安装（pip install langchain-openai）") from e

    chat = ChatOpenAI(
        model=model,
        base_url=base_url,
        api_key=api_key,
        temperature=0.3,
        max_retries=1,
    )
    resp = chat.invoke(
        [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image}},
                    {"type": "text", "text": text},
                ],
            },
        ]
    )
    out = getattr(resp, "content", "") or ""
    # 部分实现把多模态回复返回为分块列表，统一成字符串。
    if isinstance(out, list):
        out = "".join(p.get("text", "") for p in out if isinstance(p, dict))
    return out.strip()
