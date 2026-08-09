package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.order.Order;

/**
 * 请求体，对应 Python 侧 OrderFulfillmentRequest（地址补全后重算履约结论）。
 * 字段名使用 snake_case 以匹配 FastAPI 的 Pydantic 模型。
 */
public record PythonOrderFulfillmentRequest(
        @JsonProperty("order") OrderContext order,
        @JsonProperty("inventory") InventoryContext inventory) {

    public record OrderContext(
            @JsonProperty("order_id") Long orderId,
            @JsonProperty("product_id") Long productId,
            @JsonProperty("quantity") Integer quantity,
            @JsonProperty("status") String status,
            @JsonProperty("address_complete") Boolean addressComplete,
            @JsonProperty("paid") Boolean paid,
            @JsonProperty("manual_review_required") Boolean manualReviewRequired,
            @JsonProperty("fulfillment_suggestion_status") String fulfillmentSuggestionStatus) {
    }

    public record InventoryContext(
            @JsonProperty("product_id") Long productId,
            @JsonProperty("current_stock") Integer currentStock,
            @JsonProperty("reserved_stock") Integer reservedStock,
            @JsonProperty("safe_stock_threshold") Integer safeStockThreshold,
            @JsonProperty("purchase_cycle_days") Integer purchaseCycleDays,
            @JsonProperty("sales_last_7_days") Integer salesLast7Days,
            @JsonProperty("inventory_status") String inventoryStatus) {
    }

    public static PythonOrderFulfillmentRequest from(Order order, Inventory inventory) {
        OrderContext orderContext = new OrderContext(
                order.getId(),
                order.getProduct().getId(),
                order.getQuantity(),
                order.getStatus(),
                order.getAddressComplete(),
                order.getPaid(),
                order.getManualReviewRequired(),
                order.getFulfillmentSuggestionStatus());

        InventoryContext inventoryContext = new InventoryContext(
                inventory.getProduct().getId(),
                inventory.getCurrentStock(),
                inventory.getReservedStock(),
                inventory.getSafeStockThreshold(),
                inventory.getPurchaseCycleDays(),
                inventory.getSalesLast7Days(),
                inventory.getInventoryStatus());

        return new PythonOrderFulfillmentRequest(orderContext, inventoryContext);
    }
}
