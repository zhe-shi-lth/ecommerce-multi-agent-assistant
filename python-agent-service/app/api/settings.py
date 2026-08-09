"""设置中心接口：读取/保存运行时配置（持久化到 settings.json）。

- GET  /agent/ecommerce/settings        -> 当前设置
- GET  /agent/ecommerce/model-catalog   -> 厂家+模型目录（前端据此渲染下拉，base_url 由目录派生）
- GET  /agent/ecommerce/capabilities     -> 各能力当前是否可用
- PUT  /agent/ecommerce/settings         -> 部分更新（补丁）并返回保存后的完整设置

校验原则（对应「选厂家 + 选模型」而非手填模型名）：
- 已知厂家的 model 必须在目录模型列表内；base_url 强制用目录派生值（不接受手填），
  从根本上杜绝 happyhorse 等视频模型被错配到 OpenAI 兼容端点导致 404。
- 仅 "custom" 厂家允许手填 base_url + 模型名。
- 凭证（API key / base_url）仅来自页面设置中心，不读 .env。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import model_catalog
from app.settings_store import DEFAULT_SETTINGS, PLATFORM_KEYS, capabilities, get_settings, save_settings

router = APIRouter(prefix="/agent/ecommerce", tags=["settings"])

_CAPABILITIES = ("llm", "image", "video", "monitor")


class SettingsPatch(BaseModel):
    llm: dict | None = Field(default=None)
    image: dict | None = Field(default=None)
    video: dict | None = Field(default=None)
    monitor: dict | None = Field(default=None)
    platform_api: dict | None = Field(default=None)
    image_review_enabled: bool | None = Field(default=None)
    rag_enabled: bool | None = Field(default=None)


def _validate(patch: dict) -> dict:
    """就地校验并规整补丁；非法字段抛 HTTPException。

    已知厂家：model 必须在目录内（patch 未带 vendor 时按当前厂家校验），base_url 强制用目录派生；
    custom：base_url 必填。从根上杜绝把视频模型错配到 OpenAI 兼容端点。
    """
    current_settings = get_settings()
    for cap in _CAPABILITIES:
        block = patch.get(cap)
        if not isinstance(block, dict):
            continue

        if "enabled" in block and not isinstance(block["enabled"], bool):
            raise HTTPException(status_code=400, detail=f"{cap}.enabled 必须是布尔")
        if "model" in block and not isinstance(block["model"], str):
            raise HTTPException(status_code=400, detail=f"{cap}.model 必须是字符串")
        if "edit_model" in block and not isinstance(block["edit_model"], str):
            raise HTTPException(status_code=400, detail=f"{cap}.edit_model 必须是字符串")
        if cap == "image" and "ref_strength" in block:
            rs = block["ref_strength"]
            if not isinstance(rs, (int, float)) or not (0.0 <= float(rs) <= 1.0):
                raise HTTPException(status_code=400, detail="image.ref_strength 必须在 0~1 之间")

        # 有效厂家：patch 带了 vendor 用 patch 的，否则用当前设置的 vendor。
        vendor = block.get("vendor")
        if vendor is None:
            default_vendor = "qwen" if cap == "image" else "dashscope"
            vendor = (current_settings.get(cap, {}) or {}).get("vendor") or default_vendor

        if "vendor" in block and not model_catalog.is_known_vendor(cap, vendor):
            allowed = list(model_catalog.CATALOG[cap].keys())
            raise HTTPException(status_code=400, detail=f"{cap}.vendor 必须是 {allowed}")

        if vendor != "custom":
            if "model" in block and not model_catalog.validate_selection(cap, vendor, block["model"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"{cap}.model 不在「{vendor}」支持的模型列表内，请从下拉选择",
                )
            # 已知厂家：base_url 强制派生，忽略手填
            block["base_url"] = model_catalog.resolve_base_url(
                cap, vendor, block.get("model") or (current_settings.get(cap, {}) or {}).get("model", "")
            )
        else:
            # custom：base_url 必填（视频/出图等必须知道端点）
            if "base_url" in block and not str(block["base_url"]).strip():
                raise HTTPException(status_code=400, detail=f"{cap}.base_url 不能为空（自定义厂家需填写端点）")

    for key in ("image_review_enabled", "rag_enabled"):
        if key in patch and not isinstance(patch[key], bool):
            raise HTTPException(status_code=400, detail=f"{key} 必须是布尔")

    # 平台对接：非 LLM 配置块（每平台 enabled + 凭证），不进上面的模型目录循环。
    pa = patch.get("platform_api")
    if isinstance(pa, dict):
        cleaned: dict = {}
        for p, block in pa.items():
            if p not in PLATFORM_KEYS:
                raise HTTPException(status_code=400, detail=f"platform_api 不支持的平台：{p}")
            if not isinstance(block, dict):
                raise HTTPException(status_code=400, detail=f"platform_api.{p} 必须是对象")
            if "enabled" in block and not isinstance(block["enabled"], bool):
                raise HTTPException(status_code=400, detail=f"platform_api.{p}.enabled 必须是布尔")
            for k in ("app_key", "app_secret", "endpoint", "shop_id", "access_token"):
                if k in block and not isinstance(block[k], str):
                    raise HTTPException(status_code=400, detail=f"platform_api.{p}.{k} 必须是字符串")
            endpoint = str(block.get("endpoint") or "").strip()
            if endpoint and not endpoint.startswith(("http://", "https://")):
                raise HTTPException(status_code=400, detail=f"platform_api.{p}.endpoint 必须以 http(s):// 开头")
            if block.get("enabled") and not (block.get("app_key") or "").strip():
                raise HTTPException(status_code=400, detail=f"已开启{p}对接，请填写 App Key")
            cleaned[p] = block
        patch["platform_api"] = cleaned

    # 仅保留已知键，避免写入无关字段
    allowed = set(DEFAULT_SETTINGS.keys()) | {"image_review_enabled", "rag_enabled"}
    return {k: v for k, v in patch.items() if k in allowed}


@router.get("/settings")
def get_settings_endpoint() -> dict:
    return get_settings()


@router.get("/model-catalog")
def model_catalog_endpoint() -> dict:
    """厂家+模型目录：前端据此渲染下拉，每个模型条目含 label / api_style / 派生 base_url。"""
    return model_catalog.get_catalog()


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
