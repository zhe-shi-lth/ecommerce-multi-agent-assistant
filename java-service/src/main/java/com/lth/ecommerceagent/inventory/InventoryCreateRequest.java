package com.lth.ecommerceagent.inventory;

public record InventoryCreateRequest(
        Long productId,
        Integer currentStock,
        Integer reservedStock,
        Integer safeStockThreshold,
        Integer purchaseCycleDays,
        Integer salesLast7Days,
        String inventoryStatus) {
}
