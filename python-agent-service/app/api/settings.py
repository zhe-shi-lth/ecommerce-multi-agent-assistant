"""设置中心接口：读取/保存运行时配置（持久化到 settings.json）。

- GET  /agent/ecommerce/settings  -> 当前设置
- PUT  /agent/ecommerce/settings  -> 部分更新（补丁）并返回保存后的完整设置
仅保存「厂家 / 模型名 / 开关 / 图文比重」等 UI 可控项；凭证（API key / base_url）仍在 .env。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.settings_store import DEFAULT_SETTINGS, capabilities, get_settings, save_settings

router = APIRouter(prefix="/agent/ecommerce", tags=["settings"])

_LLM_VENDORS = ["dashscope", "ollama", "openai"]
_VISION_VENDORS = ["dashscope"]


class SettingsPatch(BaseModel):
    llm: dict | None = Field(default=None)
    vision: dict | None = Field(default=None)
    image: dict | None = Field(default=None)
    image_review_enabled: bool | None = Field(default=None)
    rag_enabled: bool | None = Field(default=None)


def _validate(patch: dict) -> dict:
    """就地校验并规整补丁；非法字段抛 HTTPException。"""
    llm = patch.get("llm")
    if isinstance(llm, dict):
        if "vendor" in llm and llm["vendor"] not in _LLM_VENDORS:
            raise HTTPException(status_code=400, detail=f"llm.vendor 必须是 {_LLM_VENDORS}")
        if "model" in llm and not isinstance(llm["model"], str):
            raise HTTPException(status_code=400, detail="llm.model 必须是字符串")

    vision = patch.get("vision")
    if isinstance(vision, dict):
        if "vendor" in vision and vision["vendor"] not in _VISION_VENDORS:
            raise HTTPException(status_code=400, detail=f"vision.vendor 必须是 {_VISION_VENDORS}")
        if "model" in vision and not isinstance(vision["model"], str):
            raise HTTPException(status_code=400, detail="vision.model 必须是字符串")

    image = patch.get("image")
    if isinstance(image, dict):
        if "enabled" in image and not isinstance(image["enabled"], bool):
            raise HTTPException(status_code=400, detail="image.enabled 必须是布尔")
        if "model" in image and not isinstance(image["model"], str):
            raise HTTPException(status_code=400, detail="image.model 必须是字符串")
        if "edit_model" in image and not isinstance(image["edit_model"], str):
            raise HTTPException(status_code=400, detail="image.edit_model 必须是字符串")
        if "ref_strength" in image:
            rs = image["ref_strength"]
            if not isinstance(rs, (int, float)) or not (0.0 <= float(rs) <= 1.0):
                raise HTTPException(status_code=400, detail="image.ref_strength 必须在 0~1 之间")

    for key in ("image_review_enabled", "rag_enabled"):
        if key in patch and not isinstance(patch[key], bool):
            raise HTTPException(status_code=400, detail=f"{key} 必须是布尔")

    # 仅保留已知键，避免写入无关字段
    allowed = set(DEFAULT_SETTINGS.keys())
    return {k: v for k, v in patch.items() if k in allowed}


@router.get("/settings")
def get_settings_endpoint() -> dict:
    return get_settings()


@router.get("/capabilities")
def capabilities_endpoint() -> dict:
    """各模型功能当前是否可用（基于部署开关 + 运行时设置 + 是否填了 Key）。

    前端在调用大模型功能前据此拦截并提示用户去设置中心填 Key。
    """
    return capabilities()


@router.put("/settings")
def put_settings_endpoint(patch: SettingsPatch) -> dict:
    raw = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    clean = _validate(raw)
    return save_settings(clean)
