package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.product.Product;

/**
 * 请求体，对应 Python 侧 OperationPlanRequest。
 * 字段名使用 snake_case 以匹配 FastAPI 的 Pydantic 模型。
 */
public record PythonOperationPlanRequest(
        @JsonProperty("product") ProductContext product,
        @JsonProperty("inventory") InventoryContext inventory,
        @JsonProperty("order") OrderContext order,
        @JsonProperty("trigger_type") String triggerType) {

    public record ProductContext(
            @JsonProperty("product_id") Long productId,
            @JsonProperty("name") String name,
            @JsonProperty("category") String category,
            @JsonProperty("description") String description,
            @JsonProperty("cost_price") Double costPrice,
            @JsonProperty("sale_price") Double salePrice,
            @JsonProperty("target_audience") String targetAudience,
            @JsonProperty("usage_scenario") String usageScenario,
            @JsonProperty("status") String status) {
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

    public static PythonOperationPlanRequest from(
            Product product, Inventory inventory, Order order, String triggerType) {
        ProductContext productContext = new ProductContext(
                product.getId(),
                product.getName(),
                product.getCategory(),
                product.getDescription(),
                product.getCostPrice().doubleValue(),
                product.getSalePrice().doubleValue(),
                product.getTargetAudience(),
                product.getUsageScenario(),
                product.getStatus());

        InventoryContext inventoryContext = new InventoryContext(
                inventory.getProduct().getId(),
                inventory.getCurrentStock(),
                inventory.getReservedStock(),
                inventory.getSafeStockThreshold(),
                inventory.getPurchaseCycleDays(),
                inventory.getSalesLast7Days(),
                inventory.getInventoryStatus());

        OrderContext orderContext = new OrderContext(
                order.getId(),
                order.getProduct().getId(),
                order.getQuantity(),
                order.getStatus(),
                order.getAddressComplete(),
                order.getPaid(),
                order.getManualReviewRequired(),
                order.getFulfillmentSuggestionStatus());

        return new PythonOperationPlanRequest(productContext, inventoryContext, orderContext, triggerType);
    }
}
