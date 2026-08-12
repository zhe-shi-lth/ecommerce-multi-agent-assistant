package com.lth.ecommerceagent.inventory;

public record InventoryAdjustmentRequest(Integer newCurrentStock, String reason) {
}
