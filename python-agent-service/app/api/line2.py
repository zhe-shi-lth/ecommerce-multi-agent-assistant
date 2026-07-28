"""线2 监控端点：智能库存预警 + 补货清单闭环。

- GET  /line2/inventory-warnings        返回可售天数 < 5 天的商品库存预警列表。
- POST /line2/generate-restock-plans    对全部 WARN 商品生成"补货计划清单"并落库
                                         （Java operation_plan，line=LINE2_RESTOCK），
                                         形成"预警 → 补货清单 → 人工审核"的闭环。

预警由 InventoryMonitorAgent 基于实际日销 + LLM 判断的未来事件智能估算。
"""

from fastapi import APIRouter

from app.agents.inventory_monitor_agent import InventoryMonitorAgent
from app.agents.inventory_purchase_agent import InventoryPurchaseAgent
from app.schemas.inventory import InventoryContext
from app.tools.java_api_client import JavaApiClient, logger

router = APIRouter(prefix="/agent/ecommerce", tags=["line2-monitor"])


@router.get("/line2/inventory-warnings")
def inventory_warnings() -> list[dict]:
    """返回可售天数 < 5 天的商品库存预警。异常时返回空列表（前端友好降级）。"""
    try:
        client = JavaApiClient()
        inventories = client.get_inventories()
        agent = InventoryMonitorAgent()
        warnings: list[dict] = []
        for inv in inventories:
            product_id = inv.get("productId")
            product = client.get_product(product_id) if product_id is not None else None
            product_name = product.get("name") if product else f"#{product_id}"
            daily_sales = client.list_daily_sales(product_id)
            result = agent.run(inv, daily_sales, product_name)
            if result.get("level") == "WARN":
                warnings.append(result)
        return warnings
    except Exception as e:  # noqa: BLE001
        # 监控预警不应阻断页面；异常时返回空列表。
        logger.error("线2 库存预警计算失败: {}", e)
        return []


def _to_inventory_context(inv: dict, event_mult: float = 1.0) -> InventoryContext:
    """把 Java 库存记录映射为确定性内核所需的 InventoryContext。

    event_mult > 1 时，把近 7 日销量按事件倍率放大，使补货量计入即将到来的
    大促/节假日需求（与监控预警口径一致）。
    """
    base_sales = int(inv.get("salesLast7Days") or 0)
    sales_7d = int(round(base_sales * max(1.0, event_mult)))
    return InventoryContext(
        product_id=int(inv.get("productId") or 0),
        current_stock=int(inv.get("currentStock") or 0),
        reserved_stock=int(inv.get("reservedStock") or 0),
        safe_stock_threshold=int(inv.get("safeStockThreshold") or 0),
        purchase_cycle_days=int(inv.get("purchaseCycleDays") or 0),
        sales_last_7_days=sales_7d,
        inventory_status=inv.get("inventoryStatus") or "MONITORED",
    )


@router.post("/line2/generate-restock-plans")
def generate_restock_plans() -> dict:
    """对当前所有库存预警（WARN）商品，生成"补货计划清单"并落库（闭环）。

    返回生成结果与失败项，供前端弹窗展示并跳转到运营计划列表查看。
    """
    try:
        client = JavaApiClient()
        monitor = InventoryMonitorAgent()
        purchase = InventoryPurchaseAgent()
        inventories = client.get_inventories()

        created: list[dict] = []
        skipped: list[dict] = []
        failed: list[dict] = []

        for inv in inventories:
            product_id = inv.get("productId")
            product = client.get_product(product_id) if product_id is not None else None
            product_name = product.get("name") if product else f"#{product_id}"
            daily_sales = client.list_daily_sales(product_id)

            monitor_result = monitor.run(inv, daily_sales, product_name)
            if monitor_result.get("level") != "WARN":
                continue

            # 用监控口径的事件倍率放大需求，使补货量计入即将到来的大促/节假日。
            event_mult = float(monitor_result.get("eventMultiplier") or 1.0)
            inventory_ctx = _to_inventory_context(inv, event_mult)
            plan = purchase.run(inventory_ctx)  # 无关联订单 -> 主动补货

            if not plan.should_restock:
                skipped.append({"productId": product_id, "productName": product_name})
                continue

            final_summary = (
                f"补货计划清单：商品「{product_name}」当前可用库存 {plan.available_stock}，"
                f"建议补货 {plan.suggested_restock_quantity} 件，优先级 {plan.restock_priority}。"
            )
            op_id = client.persist_restock_plan(
                product_id, plan.model_dump(), final_summary
            )
            if op_id is None:
                failed.append({"productId": product_id, "productName": product_name})
            else:
                created.append(
                    {
                        "productId": product_id,
                        "productName": product_name,
                        "operationPlanId": op_id,
                        "suggestedRestockQuantity": plan.suggested_restock_quantity,
                        "restockPriority": plan.restock_priority,
                    }
                )

        return {
            "generated": len(created),
            "created": created,
            "skipped": skipped,
            "failed": failed,
        }
    except Exception as e:  # noqa: BLE001
        logger.error("线2 生成补货清单失败: {}", e)
        return {"generated": 0, "created": [], "skipped": [], "failed": [], "error": str(e)}
