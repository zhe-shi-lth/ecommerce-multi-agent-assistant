"""通义千问视觉模型（DashScope）封装：看图生成文本。

用于「上传商品图 → 结合图片与商家备注生成文案」的多模态场景，复用 DASHSCOPE_API_KEY。
百炼平台需经官方 dashscope SDK 解析正确的 workspace/endpoint（裸 HTTP 调用会被拒），
故此处走 SDK 的 MultiModalConversation。

vl_chat(system_prompt, text, image) -> str：返回视觉模型的文本回复。
无 key / SDK 缺失 / 调用失败 -> 抛异常，由调用方降级到规则实现。
"""
import os

from dotenv import load_dotenv

from app import config
from app.settings_store import get_settings


def vl_chat(system_prompt: str, text: str, image: str, model: str | None = None) -> str:
    # fastapi dev 的 reload 不监听 .env；请求时强制重新读取，确保运行时新增的 key 即时生效。
    load_dotenv(override=True)
    api_key = os.getenv("DASHSCOPE_API_KEY") or config.DASHSCOPE_API_KEY
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY 未配置，无法看图生成文案")

    try:
        import dashscope
        from dashscope import MultiModalConversation
    except ImportError as e:  # SDK 未安装
        raise RuntimeError("dashscope SDK 未安装（pip install dashscope）") from e

    dashscope.api_key = api_key
    messages = [
        {
            "role": "user",
            "content": [
                {"image": image},
                {"text": f"{system_prompt}\n\n{text}"},
            ],
        }
    ]
    vision_model = model or get_settings().get("vision", {}).get("model") or config.DASHSCOPE_VL_MODEL
    resp = MultiModalConversation.call(model=vision_model, messages=messages)
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(
            f"视觉模型调用失败: {getattr(resp, 'code', '')} {getattr(resp, 'message', '')}"
        )

    out = resp.output
    choices = out.get("choices") if hasattr(out, "get") else None
    choices = choices or []
    parts = choices[0].get("message", {}).get("content", []) if choices else []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")]
    return "\n".join(texts).strip()
