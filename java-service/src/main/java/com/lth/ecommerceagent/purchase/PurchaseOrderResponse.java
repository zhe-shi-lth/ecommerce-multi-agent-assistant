package com.lth.ecommerceagent.purchase;

import java.time.Instant;

/** 采购补货单响应（与 orders 表同构的扁平结构，productId 供前端关联商品名）。 */
public record PurchaseOrderResponse(
        Long id,
        Long productId,
        Integer quantity,
        String supplier,
        String status,
        String note,
        Instant orderedAt,
        Instant inboundAt,
        Instant stockedAt,
        Instant createdAt,
        Instant updatedAt) {

    public static PurchaseOrderResponse from(PurchaseOrder o) {
        return new PurchaseOrderResponse(
                o.getId(),
                o.getProduct().getId(),
                o.getQuantity(),
                o.getSupplier(),
                o.getStatus(),
                o.getNote(),
                o.getOrderedAt(),
                o.getInboundAt(),
                o.getStockedAt(),
                o.getCreatedAt(),
                o.getUpdatedAt());
    }
}
