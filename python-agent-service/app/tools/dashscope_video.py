"""DashScope 原生视频适配器（/api/v1/.../video-synthesis）。

与 OpenAI 兼容客户端不同，视频模型（wan2.7 / happyhorse）只能走阿里原生结构：
- 请求体：``{"model": ..., "input": {...}, "parameters": {...}}``
- 必须带 Header ``X-DashScope-Async: enable``（HTTP 仅支持异步调用）
- 创建任务返回 ``output.task_id``；再 ``GET /api/v1/tasks/{task_id}`` 查询，SUCCEEDED 取 ``output.video_url``

三种 kind（由模型目录 model_kind 决定）：
- ``t2v``（文生视频）：input.prompt(+negative_prompt/audio_url)；parameters.resolution/ratio/duration
- ``i2v``（图生视频）：input.prompt + input.image_url；parameters 同上
- ``edit``（欢乐马视频编辑）：input.prompt + input.media=[{type:video,url},{type:reference_image,url}...]；
  parameters.resolution/watermark/audio_setting

设计原则（与全局一致）：缺 Key / 端点不可达 / 模型不支持 → 抛 ConfigError（由 API 转 422 中文，前端弹窗），
不静默降级。
"""
from __future__ import annotations

import httpx

from app.errors import ConfigError

# 终态
_TERMINAL = ("SUCCEEDED", "FAILED", "CANCELED", "UNKNOWN")


class DashScopeVideoGenerator:
    """按视频卡片（vendor=dashscope 原生）创建并查询视频任务。"""

    def __init__(self, api_key: str, base_url: str, model: str, kind: str | None) -> None:
        self._api_key = api_key
        self._base_url = (base_url or "").rstrip("/")
        self._model = model
        self._kind = kind or "t2v"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable",
        }

    def _build_body(
        self,
        prompt: str,
        image_url: str | None = None,
        video_url: str | None = None,
        resolution: str = "720P",
        duration: int = 5,
        ratio: str = "16:9",
        negative_prompt: str | None = None,
        audio_url: str | None = None,
        watermark: bool = False,
        audio_setting: str = "auto",
    ) -> dict:
        inp: dict = {"prompt": prompt}
        params: dict = {"resolution": resolution}
        if self._kind == "t2v":
            if negative_prompt:
                inp["negative_prompt"] = negative_prompt
            if audio_url:
                inp["audio_url"] = audio_url
            params["ratio"] = ratio
            params["duration"] = duration
            params["prompt_extend"] = True
        elif self._kind == "i2v":
            if not image_url:
                raise ConfigError("图生视频（i2v）需要 image_url")
            inp["image_url"] = image_url
            params["ratio"] = ratio
            params["duration"] = duration
            params["prompt_extend"] = True
        elif self._kind == "edit":
            if not video_url:
                raise ConfigError("视频编辑（edit）需要 video_url")
            media = [{"type": "video", "url": video_url}]
            if image_url:
                media.append({"type": "reference_image", "url": image_url})
            inp["media"] = media
            params["watermark"] = watermark
            params["audio_setting"] = audio_setting
        else:
            raise ConfigError(f"不支持的视频 kind：{self._kind}")
        return {"model": self._model, "input": inp, "parameters": params}

    def create_task(self, **kwargs) -> str:
        """创建视频任务，返回 task_id（不阻塞）。"""
        if not self._api_key:
            raise ConfigError("未填写视频 API Key（请在设置中心视频卡片填写）")
        if not self._base_url:
            raise ConfigError("视频端点 base_url 为空（请选择已知厂家或填写自定义端点）")
        body = self._build_body(**kwargs)
        try:
            resp = httpx.post(self._base_url, headers=self._headers(), json=body, timeout=30.0)
        except httpx.RequestError as e:
            raise ConfigError(f"视频请求失败（端点不可达）：{e}") from e
        if resp.status_code != 200:
            raise ConfigError(f"视频任务创建失败（HTTP {resp.status_code}）：{resp.text[:500]}")
        try:
            data = resp.json()
        except ValueError as e:
            raise ConfigError(f"视频任务创建返回非 JSON：{resp.text[:500]}") from e
        task_id = (data.get("output") or {}).get("task_id")
        if not task_id:
            raise ConfigError(f"视频任务创建未返回 task_id：{data}")
        return task_id

    def _task_url(self, task_id: str) -> str:
        # base_url 形如 .../api/v1/services/aigc/video-generation/video-synthesis，
        # 任务查询在 .../api/v1/tasks/{task_id}。自定义端点若无 /services/ 则直接拼 /tasks/。
        if "/services/" in self._base_url:
            base = self._base_url.split("/services/")[0]
        else:
            base = self._base_url
        return f"{base}/tasks/{task_id}"

    def query_task(self, task_id: str) -> dict:
        """单次查询任务状态，返回 {status, video_url?}。

        - SUCCEEDED：返回 video_url。
        - FAILED/CANCELED/UNKNOWN：抛 ConfigError（含原因）。
        - PENDING/RUNNING：返回当前 status，由调用方（前端）继续轮询。
        不做长轮询，避免阻塞 HTTP 请求（与 DashScope 异步模型一致）。
        """
        url = self._task_url(task_id)
        try:
            resp = httpx.get(
                url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=30.0,
            )
        except httpx.RequestError as e:
            raise ConfigError(f"视频任务查询失败：{e}") from e
        if resp.status_code != 200:
            raise ConfigError(f"视频任务查询失败（HTTP {resp.status_code}）：{resp.text[:500]}")
        try:
            data = resp.json()
        except ValueError as e:
            raise ConfigError(f"视频任务查询返回非 JSON：{resp.text[:500]}") from e
        out = data.get("output") or {}
        status = out.get("task_status")
        if status == "SUCCEEDED":
            video_url = out.get("video_url")
            if not video_url:
                raise ConfigError(f"视频任务成功但未返回 video_url：{data}")
            return {"status": "SUCCEEDED", "video_url": video_url}
        if status in ("FAILED", "CANCELED", "UNKNOWN"):
            msg = out.get("message") or out.get("code") or "未知错误"
            raise ConfigError(f"视频任务{status}：{msg}")
        return {"status": status or "UNKNOWN", "video_url": None}


def get_video_generator() -> DashScopeVideoGenerator:
    """按视频卡片构造原生适配器；配置缺失直接抛 ConfigError。"""
    from app.settings_store import resolve_video_credentials

    vendor, api_key, model, kind, base_url = resolve_video_credentials()
    if not api_key:
        raise ConfigError("未填写视频 API Key（请在设置中心视频卡片填写）")
    if vendor != "dashscope" and not base_url:
        raise ConfigError("视频自定义厂家需填写 base_url（原生 /api/v1 端点）")
    return DashScopeVideoGenerator(api_key=api_key, base_url=base_url, model=model, kind=kind)
