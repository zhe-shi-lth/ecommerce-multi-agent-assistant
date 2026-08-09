"""运行时设置中心：把原先散落在 .env 的开关/模型选择，改为可经 UI 实时修改并持久化。

- 持久化到本文件同级的 settings.json（已 gitignore），重启后保留用户选择。
- 未生成 settings.json 时使用 DEFAULT_SETTINGS（与历史 .env 默认值保持一致）。
- LLM / 出图 / 视频 三张卡片各自独立配置（base_url / 模型 / API Key），
  **互不借用**：每张卡片的 Key 只来自本卡片，不回退其他卡片也不读 .env。
- 出图支持多厂家：默认阿里云 qwen-image（官方 dashscope SDK，MultiModalConversation.call），
  以及 OpenAI（官方 openai SDK）/ Google（google-genai）/ Stability（官方 REST v2beta）。
  各厂家按官方文档走对应适配器，缺 Key/模型 → 直接报错（不降级、不静默兼容）。
- 离线/规则模式：`LLM_ENABLED=false`（部署级）或 `llm.vendor="rule"`（页面选）时，
  Agent 显式走确定性规则输出；这是用户/部署**显式选择**，不是隐式降级。
- save_settings 会清掉 LLM 客户端缓存，使厂家/模型/Key 切换立即生效。
"""
from __future__ import annotations

import copy
import json
import threading
from pathlib import Path
from typing import Any

from app import config
from app import model_catalog

# 存到仓库根的 data/ 下，刻意放在 python-agent-service 源码树之外——
# 否则 fastapi dev 的 --reload 监听会把它当成源码变更，保存设置时反复重启服务。
SETTINGS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "settings.json"

# 订单来源平台（与前端 frontend/src/platforms.ts、Java orders.platform 保持一致）。
PLATFORM_KEYS = ("taobao", "douyin", "xiaohongshu")

# 平台对接凭证字段模板：面向用户的「填了就能用」最小集合。
# access_token 三家订单接口（taobao.trades.sold.get / 抖店 order.searchList / 小红书 order.getOrderList）
# 都需要 OAuth 授权令牌，缺它"填好即用"不成立。
_PLATFORM_API_FIELDS = {
    "enabled": False,
    "app_key": "",
    "app_secret": "",
    "endpoint": "",  # 空 = 用适配器内置官方网关；仅沙箱/自建代理需要手填
    "shop_id": "",  # 抖店 shop_id / 小红书 seller_id / 淘宝 seller_nick
    "access_token": "",  # OAuth 授权令牌
}

DEFAULT_SETTINGS: dict[str, Any] = {
    # 文本 LLM（OpenAI 兼容）：启用开关 + 厂家预设键 + base_url + 模型名（空串=厂家默认）
    # + 云端 API Key（UI 可填，存本地 settings.json；不读 .env，页面即唯一配置来源）。
    "llm": {
        "enabled": True,
        "vendor": "dashscope",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "",
        "api_key": "",
    },
    # 出图：独立卡片。默认走阿里云 qwen-image（官方 dashscope SDK）。
    # api_key / model / base_url 均只来自本卡片，不借用 LLM 卡片、不读 .env。
    "image": {
        "enabled": True,
        "vendor": "qwen",
        "base_url": "",
        "model": "qwen-image-2.0-pro-2026-06-22",
        "edit_model": "qwen-image-2.0-pro-2026-06-22",
        "api_key": "",
        "ref_strength": 0.4,
    },
    # 视频：独立卡片。vendor 决定适配器（当前仅 dashscope 原生 /api/v1）；
    # api_style=dashscope_video。base_url 由模型目录派生（原生视频端点），不手填。
    "video": {
        "enabled": True,
        "vendor": "dashscope",
        "base_url": "",
        "model": "wan2.7-t2v",
        "api_key": "",
    },
    # 库存监控（线2 智能预警）：独立卡片，默认关闭。
    # 关闭 / 未填 Key / 端点不可达 / 调用失败 → 一律走红线降级（可售天数<5天预警），不报错、不卡。
    "monitor": {
        "enabled": False,
        "vendor": "dashscope",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "",
        "api_key": "",
    },
    # 平台对接（订单来源开放 API）：独立非 LLM 配置块，按平台各一份。
    # 未启用 / 缺凭证 → 真实模式失败闭合并给出可读原因（不静默降级回模拟数据）。
    # 凭证只来自本卡片，不读 .env；Java 不持有任何平台密钥（真实拉单时由 Python 读此处凭证翻译协议）。
    "platform_api": {p: dict(_PLATFORM_API_FIELDS) for p in PLATFORM_KEYS},
    "image_review_enabled": True,
    "rag_enabled": False,
}

# 可重入锁：save_settings 持锁期间会调用 load_settings（同样取锁），
# 必须用 RLock，否则普通 Lock 会死锁导致请求挂起（PUT 一直 000）。
_lock = threading.RLock()
_cache: dict[str, Any] | None = None


def _deep_merge(base: dict, override: dict) -> dict:
    """浅层合并（顶层为各配置块），override 中缺失的块沿用 base。"""
    merged = dict(base)
    for key, val in (override or {}).items():
        if isinstance(val, dict) and isinstance(base.get(key), dict):
            merged[key] = {**base[key], **val}
        else:
            merged[key] = val
    return merged


def _normalize(data: dict) -> dict:
    """基于模型目录规整，彻底杜绝错配（如把视频模型填到 OpenAI 兼容端点）：

    - 已知厂家的 model 必须在目录模型列表内，否则回退该厂家默认模型；
    - 已知厂家的 base_url 强制用目录派生值（不接受手填，防止 happyhorse 落在 /compatible-mode）；
      仅 "custom" 厂家保留用户手填的 base_url。
    """
    for cap in ("llm", "image", "video", "monitor"):
        block = data.get(cap)
        if not isinstance(block, dict):
            continue
        vendor = (block.get("vendor") or "").strip()
        if not model_catalog.is_known_vendor(cap, vendor):
            continue
        model = (block.get("model") or "").strip()
        if not model_catalog.validate_selection(cap, vendor, model):
            block["model"] = model_catalog.default_model(cap, vendor)
        if vendor != "custom":
            block["base_url"] = model_catalog.resolve_base_url(cap, vendor, block.get("model", ""))
        # 出图卡片的 edit_model 同样校验（已知厂家）：优先保留厂家内含 imageedit 的图生图模型，否则回退主模型。
        if cap == "image" and vendor != "custom":
            edit_model = (block.get("edit_model") or "").strip()
            vendor_models = model_catalog.CATALOG["image"].get(vendor, {}).get("models", [])
            ids = [m["id"] for m in vendor_models]
            if edit_model not in ids:
                block["edit_model"] = next(
                    (m["id"] for m in vendor_models if "imageedit" in m["id"]),
                    block.get("model", ""),
                )

    # 订单监控（地址复核）已改为模式无关：始终经 PlatformAdapter.get_address_complete 复核，
    # 不再有 demo/real 配置块。若历史 settings.json 仍残留 order_monitor，直接丢弃，避免误导。
    data.pop("order_monitor", None)

    # 平台对接：非 LLM 配置块，不进上面的模型目录校验循环。按已知平台整体重建，
    # 缺字段补默认、未知平台丢弃——同时修掉 _deep_merge 只合并两层导致的子块被整体覆盖问题。
    raw = data.get("platform_api")
    raw = raw if isinstance(raw, dict) else {}
    data["platform_api"] = {
        p: {
            "enabled": bool((raw.get(p) or {}).get("enabled", False)),
            "app_key": str((raw.get(p) or {}).get("app_key") or "").strip(),
            "app_secret": str((raw.get(p) or {}).get("app_secret") or "").strip(),
            "endpoint": str((raw.get(p) or {}).get("endpoint") or "").strip(),
            "shop_id": str((raw.get(p) or {}).get("shop_id") or "").strip(),
            "access_token": str((raw.get(p) or {}).get("access_token") or "").strip(),
        }
        for p in PLATFORM_KEYS
    }
    return data


def load_settings() -> dict[str, Any]:
    """返回当前设置（带缓存）；首次读取时与 settings.json 合并默认值并规整。"""
    global _cache
    with _lock:
        if _cache is not None:
            return _cache
        data = copy.deepcopy(DEFAULT_SETTINGS)
        if SETTINGS_PATH.exists():
            try:
                user = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
                data = _deep_merge(copy.deepcopy(DEFAULT_SETTINGS), user)
            except Exception:
                data = copy.deepcopy(DEFAULT_SETTINGS)
        data = _normalize(data)
        _cache = data
        return data


def get_settings() -> dict[str, Any]:
    return load_settings()


def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    """合并补丁并持久化；清 LLM 客户端缓存，使厂家/模型切换即时生效。"""
    global _cache
    with _lock:
        data = _deep_merge(load_settings(), patch)
        data = _normalize(data)
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        _cache = data
    # 通知 LLM 客户端：设置变了，下次生成重新构造（应用新厂家/模型）
    try:
        from app.llm import client as llm_client

        llm_client.reset()
    except Exception:  # noqa: BLE001
        pass
    return data


def resolve_image_credentials() -> tuple[str, str, str, str, str]:
    """解析出图（文生图/图生图）的 (vendor, base_url, api_key, model, edit_model)。

    **只来自页面「出图」卡片**，不借用视觉卡片、不借用 LLM 卡片、不读 .env。
    面向最终用户，Key 一律在「设置中心 → 出图卡片」填写；缺 Key/模型由调用方抛 ConfigError。
    """
    s = get_settings()
    img = s.get("image", {}) or {}
    vendor = (img.get("vendor") or "qwen").strip() or "qwen"
    base_url = (img.get("base_url") or "").strip()
    api_key = (img.get("api_key") or "").strip()
    model = (img.get("model") or "").strip() or "qwen-image-2.0-pro-2026-06-22"
    edit_model = (img.get("edit_model") or "").strip() or "qwen-image-2.0-pro-2026-06-22"
    return vendor, base_url, api_key, model, edit_model


def resolve_platform_credentials(platform: str, settings: dict | None = None) -> dict[str, Any]:
    """解析某平台的对接凭证（只来自设置中心「平台对接」卡片，不读 .env）。

    返回 {platform, enabled, app_key, app_secret, endpoint, shop_id, access_token}；
    未知平台返回 enabled=False 的空凭证，由适配器工厂负责报错。
    """
    s = settings or get_settings()
    block = (s.get("platform_api", {}) or {}).get(platform, {}) or {}
    return {"platform": platform, **{k: block.get(k, v) for k, v in _PLATFORM_API_FIELDS.items()}}


def capabilities() -> dict[str, Any]:
    """探测各模型功能当前是否可用（基于部署开关 + 运行时设置 + 是否填了 Key）。

    用于在「未配置 API Key」时让前端提前拦截大模型功能（文生文 / 文生图 / 图生图 / 视频），
    而不是静默走规则降级或后端报错。仅做本地判定（Key 是否存在、开关是否打开），不发网络请求。
    """
    s = get_settings()
    llm_block = s.get("llm", {}) or {}
    image_block = s.get("image", {}) or {}

    # 文本 LLM（文生文）
    llm_reason = ""
    llm_ok = bool(config.LLM_ENABLED)
    if not llm_ok:
        llm_reason = "部署环境已关闭 LLM（LLM_ENABLED=false，走规则模式）"
    elif not llm_block.get("enabled", True):
        llm_ok = False
        llm_reason = "LLM 已在设置中心关闭"
    elif (llm_block.get("vendor") or "dashscope").strip() == "rule":
        llm_ok = True
        llm_reason = "已选择规则/离线模式（确定性输出）"
    else:
        vendor = (llm_block.get("vendor") or "dashscope").strip()
        key = (llm_block.get("api_key") or "").strip()
        if not key and vendor != "ollama":
            llm_ok = False
            llm_reason = "未填写 LLM 的 API Key（请在设置中心 LLM 卡片填写）"

    # 出图（文生图/图生图）：Key 只来自出图卡片。
    img_key = (image_block.get("api_key") or "").strip()
    img_ok = bool(image_block.get("enabled", True)) and bool(img_key)
    if not image_block.get("enabled", True):
        image_reason = "出图已在设置中心关闭"
    elif not img_key:
        image_reason = "未填写出图 API Key（请在设置中心出图卡片填写）"
    else:
        image_reason = ""

    # 视频（文生视频 / 图生视频 / 视频编辑）：Key 只来自视频卡片。
    vid_block = s.get("video", {}) or {}
    vid_key = (vid_block.get("api_key") or "").strip()
    vid_ok = bool(vid_block.get("enabled", True)) and bool(vid_key)
    if not vid_block.get("enabled", True):
        video_reason = "视频已在设置中心关闭"
    elif not vid_key:
        video_reason = "未填写视频 API Key（请在设置中心视频卡片填写）"
    else:
        video_reason = ""

    # 库存监控（线2 预警）：独立的「监控」卡片，配置错/未配 → 红线降级（不报错）。
    monitor_block = s.get("monitor", {}) or {}
    monitor_reason = ""
    monitor_ok = bool(monitor_block.get("enabled", False))
    if not monitor_ok:
        monitor_reason = "未启用监控大模型（按可售天数<5天红线预警）"
    elif (monitor_block.get("vendor") or "dashscope").strip() == "rule":
        monitor_ok = False
        monitor_reason = "已选择规则/离线模式（红线预警）"
    else:
        mvendor = (monitor_block.get("vendor") or "dashscope").strip()
        mkey = (monitor_block.get("api_key") or "").strip()
        if not mkey and mvendor != "ollama":
            monitor_ok = False
            monitor_reason = "未填写监控大模型 API Key（请在设置中心监控卡片填写，否则红线预警）"

    # 订单监控（地址复核）：模式无关，始终可用；经 PlatformAdapter 复核地址是否完整
    # （未配凭证用模拟器同构真相，配了查真实开放 API）。
    order_monitor_ok = True
    order_monitor_reason = (
        "模式无关：未配置平台凭证时返回模拟器同构真相，配置后自动查真实开放 API（address_complete）"
    )

    # 平台对接：每平台单独判定「能否真实拉单/复核」，纯本地判定（不发网络请求）。
    pa = s.get("platform_api", {}) or {}
    platform_caps: dict[str, Any] = {}
    for p in PLATFORM_KEYS:
        b = pa.get(p, {}) or {}
        if not b.get("enabled"):
            platform_caps[p] = {"available": False, "reason": "未开启对接（设置中心 → 平台对接）"}
        elif not b.get("app_key") or not b.get("app_secret"):
            platform_caps[p] = {"available": False, "reason": "未填写 App Key / App Secret"}
        elif not b.get("access_token"):
            platform_caps[p] = {"available": False, "reason": "未填写店铺授权令牌（access_token）"}
        else:
            platform_caps[p] = {"available": True, "reason": ""}

    return {
        "llm": {"available": llm_ok, "reason": llm_reason},
        "image": {"available": img_ok, "reason": image_reason},
        "video": {"available": vid_ok, "reason": video_reason},
        "monitor": {"available": monitor_ok, "reason": monitor_reason},
        "order_monitor": {"available": order_monitor_ok, "reason": order_monitor_reason},
        "platform_api": platform_caps,
    }


def resolve_video_credentials() -> tuple[str, str, str, str | None, str]:
    """解析视频生成的 (vendor, api_key, model, kind, base_url)。

    - 只来自页面「视频」卡片；api_style=dashscope_video（原生 /api/v1）。
    - base_url 由模型目录派生（dashscope 原生视频端点），custom 用卡片 base_url。
    - kind 来自目录（t2v / i2v / edit），驱动原生请求体结构。
    """
    s = get_settings()
    vid = s.get("video", {}) or {}
    vendor = (vid.get("vendor") or "dashscope").strip() or "dashscope"
    api_key = (vid.get("api_key") or "").strip()
    model = (vid.get("model") or "").strip() or model_catalog.default_model("video", vendor)
    kind = model_catalog.model_kind("video", vendor, model)
    base_url = model_catalog.resolve_base_url("video", vendor, model, vid.get("base_url", ""))
    return vendor, api_key, model, kind, base_url
