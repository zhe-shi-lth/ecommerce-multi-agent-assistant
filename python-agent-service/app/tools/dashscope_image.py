"""通义万相（DashScope）文生图封装。

百炼平台需经官方 dashscope SDK 解析正确的 workspace/endpoint（裸 HTTP 调用会被判为
body 非法），故此处统一走 SDK。

generate_image(prompt, size, n) -> list[str]：返回生成图片的 URL 列表。
无 key / SDK 缺失 / 生成失败 -> 抛异常，由 image_creative_agent 降级为占位图。
"""
import os

from dotenv import load_dotenv

from app import config


def generate_image(prompt: str, size: str = "1024*1024", n: int = 1) -> list[str]:
    # fastapi dev 的 reload 不监听 .env；请求时强制重新读取，确保运行时新增的
    # key / 开关即时生效，无需重启服务。
    load_dotenv(override=True)
    api_key = os.getenv("DASHSCOPE_API_KEY") or config.DASHSCOPE_API_KEY
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY 未配置，跳过真实文生图")

    try:
        import dashscope
        from dashscope import ImageSynthesis
    except ImportError as e:  # SDK 未安装
        raise RuntimeError("dashscope SDK 未安装（pip install dashscope）") from e

    dashscope.api_key = api_key

    resp = ImageSynthesis.call(model="wanx-v1", prompt=prompt, size=size, n=n)
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(
            f"文生图失败: {getattr(resp, 'code', '')} {getattr(resp, 'message', '')}"
        )

    results = resp.output.get("results") if hasattr(resp.output, "get") else None
    results = results or []
    urls = [r.url for r in results if getattr(r, "url", None)]
    if not urls:
        raise RuntimeError("文生图返回为空")
    return urls


def generate_image_from_reference(
    reference_image: str, prompt: str, size: str = "1024*1024", n: int = 1
) -> list[str]:
    """图生图：以 reference_image（base64 data URL 或公网 URL）为参考，按 prompt 生成新图。

    使用万相 2.7 图像生成模型（wan2.7-image）；SDK 会自动把 base64 data URL 上传到 OSS，
    无需调用方自行托管。返回生成图片的 URL 列表。
    """
    load_dotenv(override=True)
    api_key = os.getenv("DASHSCOPE_API_KEY") or config.DASHSCOPE_API_KEY
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY 未配置，跳过图生图")

    try:
        import dashscope
        from dashscope.aigc.image_generation import ImageGeneration
    except ImportError as e:  # SDK 未安装
        raise RuntimeError("dashscope SDK 未安装（pip install dashscope）") from e

    dashscope.api_key = api_key
    messages = [
        {"role": "user", "content": [{"image": reference_image}, {"text": prompt}]}
    ]
    resp = ImageGeneration.call(model="wan2.7-image", messages=messages, is_async=False)
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(
            f"图生图失败: {getattr(resp, 'code', '')} {getattr(resp, 'message', '')}"
        )

    out = dict(resp.output) if hasattr(resp.output, "get") else {}
    urls: list[str] = []
    for ch in out.get("choices") or []:
        msg = ch.get("message", {}) if isinstance(ch, dict) else {}
        for item in msg.get("content", []):
            if isinstance(item, dict) and item.get("type") == "image" and item.get("image"):
                urls.append(item["image"])
    if not urls:
        raise RuntimeError("图生图返回为空")
    return urls[:n] if n else urls
