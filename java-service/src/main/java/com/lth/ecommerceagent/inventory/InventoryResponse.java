package com.lth.ecommerceagent.inventory;

import java.time.Instant;

public record InventoryResponse(
        Long id,
        Long productId,
        Integer currentStock,
        Integer reservedStock,
        Integer safeStockThreshold,
        Integer purchaseCycleDays,
        Integer salesLast7Days,
        String inventoryStatus,
        Instant createdAt,
        Instant updatedAt) {
}
