"""线2 监控端点：智能库存预警。

前端销售监控页调用本端点，获取"可售天数 < 5 天"的商品预警列表。
预警由 InventoryMonitorAgent 基于实际日销 + 事件日历智能估算。
"""

from fastapi import APIRouter

from app.agents.inventory_monitor_agent import InventoryMonitorAgent
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
