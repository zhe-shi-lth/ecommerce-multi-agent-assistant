"""通义万相（DashScope）文生图封装。

百炼平台需经官方 dashscope SDK 解析正确的 workspace/endpoint（裸 HTTP 调用会被判为
body 非法），故此处统一走 SDK。

generate_image(prompt, size, n) -> list[str]：返回生成图片的 URL 列表。
无 key / SDK 缺失 / 生成失败 -> 抛异常，由 image_creative_agent 降级为占位图。
"""
import os

from dotenv import load_dotenv

from app import config
from app.settings_store import get_settings


def _image_model() -> str:
    return get_settings().get("image", {}).get("model") or "wanx-v1"


def _image_edit_model() -> str:
    return get_settings().get("image", {}).get("edit_model") or "wanx2.1-imageedit"


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

    resp = ImageSynthesis.call(model=_image_model(), prompt=prompt, size=size, n=n)
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


def generate_image_edit(
    prompt: str,
    base_image_url: str,
    size: str = "1024*1024",
    n: int = 1,
    ref_strength: float = 0.4,
) -> list[str]:
    """通义万相图生图（wanx2.1-imageedit，description_edit）。

    以 base_image_url（用户上传的商品图，base64 data URL）为底图，prompt 为对这张图的
    修改目标（文案），在其基础上生成精修/改图结果。无 key / SDK 缺失 / 生成失败 -> 抛异常，
    由 image_creative_agent 降级为占位图。

    ref_strength：输出图与原图的相似度（0~1，越高越像原图）。默认 0.4，给修改留出空间；
    若改得不够就调低，若商品主体都被改没了就调高。
    """
    load_dotenv(override=True)
    api_key = os.getenv("DASHSCOPE_API_KEY") or config.DASHSCOPE_API_KEY
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY 未配置，跳过图生图")

    try:
        import dashscope
        from dashscope import ImageSynthesis
    except ImportError as e:  # SDK 未安装
        raise RuntimeError("dashscope SDK 未安装（pip install dashscope）") from e

    dashscope.api_key = api_key

    resp = ImageSynthesis.call(
        model=_image_edit_model(),
        prompt=prompt,
        base_image_url=base_image_url,
        function="description_edit",
        size=size,
        n=n,
        ref_strength=ref_strength,
    )
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(
            f"图生图失败: {getattr(resp, 'code', '')} {getattr(resp, 'message', '')}"
        )

    results = resp.output.get("results") if hasattr(resp.output, "get") else None
    results = results or []
    urls = [r.url for r in results if getattr(r, "url", None)]
    if not urls:
        raise RuntimeError("图生图返回为空")
    return urls
