"""视频生成接口（DashScope 原生 /api/v1）。

- POST /agent/ecommerce/video/generate : 创建任务，返回 task_id（不阻塞）。
- GET  /agent/ecommerce/video/tasks/{task_id} : 查询任务状态，SUCCEEDED 返回 video_url。

异步模型：前端创建后按 task_id 轮询查询，直到 SUCCEEDED 拿到 video_url。
kind（t2v/i2v/edit）由视频卡片所选模型在模型目录中决定，不依赖请求体。
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.tools.dashscope_video import get_video_generator

router = APIRouter(prefix="/agent/ecommerce", tags=["video"])


class VideoGenerateRequest(BaseModel):
    prompt: str = Field(..., description="视频/编辑提示词")
    image_url: str | None = Field(default=None, description="图生视频底图 / 编辑参考图（可选）")
    video_url: str | None = Field(default=None, description="视频编辑的源视频 URL（edit 必填）")
    resolution: str = Field(default="720P", description="720P / 1080P")
    duration: int = Field(default=5, description="文/图生视频时长（秒，2~15）")
    ratio: str = Field(default="16:9", description="文/图生视频画幅")
    negative_prompt: str | None = Field(default=None, description="文生视频排除词")
    audio_url: str | None = Field(default=None, description="文生视频配音 URL（可选）")
    watermark: bool = Field(default=False, description="编辑是否加水印")
    audio_setting: str = Field(default="auto", description="编辑声音控制 auto/origin")


@router.post("/video/generate")
def video_generate(req: VideoGenerateRequest) -> dict:
    gen = get_video_generator()
    task_id = gen.create_task(
        prompt=req.prompt,
        image_url=req.image_url,
        video_url=req.video_url,
        resolution=req.resolution,
        duration=req.duration,
        ratio=req.ratio,
        negative_prompt=req.negative_prompt,
        audio_url=req.audio_url,
        watermark=req.watermark,
        audio_setting=req.audio_setting,
    )
    return {"task_id": task_id, "status": "PENDING"}


@router.get("/video/tasks/{task_id}")
def video_task(task_id: str) -> dict:
    gen = get_video_generator()
    result = gen.query_task(task_id)
    if result.get("status") == "SUCCEEDED" and result.get("video_url"):
        from app.media_store import persist_media
        result["video_url"] = persist_media(result["video_url"], "video")
    return result
