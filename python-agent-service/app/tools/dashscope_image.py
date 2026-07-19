"""通义万相（DashScope）文生图封装。

百炼平台需经官方 dashscope SDK 解析正确的 workspace/endpoint（裸 HTTP 调用会被判为
body 非法），故此处统一走 SDK。

API Key 只来自页面「设置中心」（视觉/LLM 卡片的 DashScope Key），不读 .env。

generate_image(prompt, size, n) -> list[str]：返回生成图片的 URL 列表。
无 key / SDK 缺失 / 生成失败 -> 抛异常，由 image_creative_agent 降级为占位图。
"""
from app.settings_store import get_settings, resolve_dashscope_api_key


def _resp_detail(resp) -> str:
    """汇总 DashScope 响应的关键诊断字段（含异步任务失败信息）。

    DashScope 的异步图像任务失败时常常返回 status_code=200 + task_status=FAILED +
    code/message，仅看 status_code 会误判为成功；这里把真实失败原因透出来。
    """
    parts = [f"status={getattr(resp, 'status_code', '?')}"]
    code = getattr(resp, "code", "") or ""
    message = getattr(resp, "message", "") or ""
    if code:
        parts.append(f"code={code}")
    if message:
        parts.append(f"message={message}")
    out = getattr(resp, "output", None)
    if out is not None:
        task_status = getattr(out, "task_status", "") or (out.get("task_status") if isinstance(out, dict) else "")
        out_msg = getattr(out, "message", "") or (out.get("message") if isinstance(out, dict) else "")
        if task_status:
            parts.append(f"task_status={task_status}")
        if out_msg:
            parts.append(f"output_message={out_msg}")
    return " ".join(parts)


def _image_model() -> str:
    return get_settings().get("image", {}).get("model") or "wanx-v1"


def _image_edit_model() -> str:
    return get_settings().get("image", {}).get("edit_model") or "wanx2.1-imageedit"


def generate_image(prompt: str, size: str = "1024*1024", n: int = 1) -> list[str]:
    # 出图 Key 只来自页面「设置中心」（视觉/LLM 卡片的 DashScope Key），不读 .env。
    api_key = resolve_dashscope_api_key()
    if not api_key:
        raise RuntimeError("未配置 DashScope API Key（请在设置中心填写），跳过真实文生图")

    try:
        import dashscope
        from dashscope import ImageSynthesis
    except ImportError as e:  # SDK 未安装
        raise RuntimeError("dashscope SDK 未安装（pip install dashscope）") from e

    dashscope.api_key = api_key

    resp = ImageSynthesis.call(model=_image_model(), prompt=prompt, size=size, n=n)
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(f"文生图失败: {_resp_detail(resp)}")

    results = resp.output.get("results") if hasattr(resp.output, "get") else None
    results = results or []
    urls = [r.url for r in results if getattr(r, "url", None)]
    if not urls:
        raise RuntimeError(f"文生图返回为空（{_resp_detail(resp)}）")
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
    api_key = resolve_dashscope_api_key()
    if not api_key:
        raise RuntimeError("未配置 DashScope API Key（请在设置中心填写），跳过图生图")

    try:
        import dashscope
        from dashscope import ImageSynthesis
    except ImportError as e:  # SDK 未安装
        raise RuntimeError("dashscope SDK 未安装（pip install dashscope）") from e

    dashscope.api_key = api_key

    # 注意：wanx2.1-imageedit（图生图）不接受 size 参数（输出尺寸跟随底图），
    # 传入会导致请求非法、任务 FAILED（output_message: payload.parameters.size）。
    # 仅文生图（wanx-v1）需要 size。
    resp = ImageSynthesis.call(
        model=_image_edit_model(),
        prompt=prompt,
        base_image_url=base_image_url,
        function="description_edit",
        n=n,
        ref_strength=ref_strength,
    )
    if getattr(resp, "status_code", None) != 200:
        raise RuntimeError(f"图生图失败: {_resp_detail(resp)}")

    results = resp.output.get("results") if hasattr(resp.output, "get") else None
    results = results or []
    urls = [r.url for r in results if getattr(r, "url", None)]
    if not urls:
        raise RuntimeError(f"图生图返回为空（{_resp_detail(resp)}）")
    return urls
