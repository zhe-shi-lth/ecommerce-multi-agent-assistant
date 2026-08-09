"""平台对接接口：真实数据源（订单拉取）的协议翻译层。

- POST /agent/ecommerce/platform/pull-orders：按平台分组调各自 PlatformAdapter 拉订单，
  返回中立结构订单列表给 Java 落库。Python 只负责「持有平台凭证 + 翻译平台协议」，不写库；
  落库与库存/日销联动仍在 Java 同一事务内完成（Java 是唯一数据源）。
- GET  /agent/ecommerce/platform/status：返回各平台对接就绪情况。

未配置/未接入的平台：逐个记入 warnings 返回（不静默丢弃，也不伪造订单）；若某平台适配器
尚未实现，其 `_request` 抛出的中文 ConfigError 会原样出现在 warnings 中。
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.platform import (
    PlatformOrder,
    PlanTarget,
    PublishListingPayload,
    ShipResult,
    configured_platforms,
    get_adapter,
)
from app.settings_store import capabilities

router = APIRouter(prefix="/agent/ecommerce", tags=["platform"])


class PlanTargetIn(BaseModel):
    platform: str
    plan_id: int | None = None
    product_id: int | None = None
    product_name: str | None = None
    platform_item_id: str | None = None


class PullOrdersRequest(BaseModel):
    plans: list[PlanTargetIn] = []
    since_days: int = 14


class PullOrdersResponse(BaseModel):
    orders: list[dict[str, Any]]
    platforms: list[str]
    warnings: list[str]


class PublishListingRequest(BaseModel):
    platform: str
    plan_id: int | None = None
    product_id: int | None = None
    product_name: str | None = None
    product_plan: dict[str, Any] = Field(default_factory=dict)
    image_plan: dict[str, Any] = Field(default_factory=dict)
    video_url: str | None = None


class PublishListingResponse(BaseModel):
    success: bool
    platform: str
    message: str
    external_item_id: str | None = None
    external_url: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


@router.post("/platform/pull-orders", response_model=PullOrdersResponse)
def pull_orders(request: PullOrdersRequest) -> PullOrdersResponse:
    """真实数据源：按平台分组调各自 PlatformAdapter 拉订单，返回中立结构（Python 不落库）。"""
    by_platform: dict[str, list[PlanTarget]] = {}
    for p in request.plans:
        by_platform.setdefault(p.platform, []).append(
            PlanTarget(
                platform=p.platform,
                plan_id=p.plan_id,
                product_id=p.product_id,
                product_name=p.product_name,
                platform_item_id=p.platform_item_id,
            )
        )

    orders: list[dict[str, Any]] = []
    warnings: list[str] = []
    platforms_used: list[str] = []
    for platform, plans in by_platform.items():
        try:
            pulled: list[PlatformOrder] = get_adapter(platform).list_orders(plans, request.since_days)
        except Exception as e:  # noqa: BLE001
            warnings.append(f"{platform}: {e}")
            continue
        platforms_used.append(platform)
        for o in pulled:
            orders.append(asdict(o))
    return PullOrdersResponse(orders=orders, platforms=platforms_used, warnings=warnings)


@router.post("/platform/publish-listing", response_model=PublishListingResponse)
def publish_listing(request: PublishListingRequest) -> PublishListingResponse:
    """Line 1 真实发布入口：平台未配置或真实 API 未实现时失败闭合，不返回假发布结果。"""
    payload = PublishListingPayload(
        platform=request.platform,
        plan_id=request.plan_id,
        product_id=request.product_id,
        product_name=request.product_name,
        product_plan=request.product_plan or {},
        image_plan=request.image_plan or {},
        video_url=request.video_url,
    )
    result = get_adapter(request.platform).publish_listing(payload)
    return PublishListingResponse(**asdict(result))


@router.get("/platform/status")
def platform_status() -> dict[str, Any]:
    """各平台对接是否就绪（enabled + 凭证齐全）。"""
    return {
        "platforms": capabilities().get("platform_api", {}),
        "ready": configured_platforms(),
    }


class ShipOrderRequest(BaseModel):
    platform: str
    platform_order_id: str
    logistics_company: str = ""
    waybill_no: str = ""


class ShipOrderResponse(BaseModel):
    success: bool
    message: str
    platform_ship_status: str = ""


@router.post("/platform/ship-order", response_model=ShipOrderResponse)
def ship_order(request: ShipOrderRequest) -> ShipOrderResponse:
    """回写发货到平台：调对应 PlatformAdapter.ship_order（模拟器模式返回同构成功回执）。"""
    result: ShipResult = get_adapter(request.platform).ship_order(
        request.platform_order_id, request.logistics_company, request.waybill_no
    )
    return ShipOrderResponse(
        success=result.success, message=result.message, platform_ship_status=result.platform_ship_status
    )
