package com.lth.ecommerceagent.purchase;

import java.math.BigDecimal;
import java.time.Instant;

import com.lth.ecommerceagent.supplier.Supplier;

/** 采购补货单响应（与 orders 表同构的扁平结构，productId 供前端关联商品名）。 */
public record PurchaseOrderResponse(
        Long id,
        Long productId,
        Integer quantity,
        Long supplierId,
        String supplierName,
        String status,
        String note,
        // 成本核算字段
        BigDecimal unitCost,
        BigDecimal productAmount,
        BigDecimal purchaseShippingFee,
        BigDecimal totalCost,
        BigDecimal landedUnitCost,
        Instant expectedArrivalAt,
        Integer actualQuantity,
        Integer receivedQuantity,
        Integer remainingQuantity,
        String inboundNote,
        Instant orderedAt,
        Instant inboundAt,
        Instant stockedAt,
        Instant createdAt,
        Instant updatedAt) {

    public static PurchaseOrderResponse from(PurchaseOrder o) {
        Supplier s = o.getSupplierRef();
        return new PurchaseOrderResponse(
                o.getId(),
                o.getProduct().getId(),
                o.getQuantity(),
                s != null ? s.getId() : null,
                o.getSupplierName() != null ? o.getSupplierName()
                        : (s != null ? s.getName() : null),
                o.getStatus(),
                o.getNote(),
                o.getUnitCost(),
                o.getProductAmount(),
                o.getPurchaseShippingFee(),
                o.getTotalCost(),
                o.getLandedUnitCost(),
                o.getExpectedArrivalAt(),
                o.getActualQuantity(),
                o.getReceivedQuantity(),
                Math.max(0, o.getQuantity() - (o.getReceivedQuantity() == null ? 0 : o.getReceivedQuantity())),
                o.getInboundNote(),
                o.getOrderedAt(),
                o.getInboundAt(),
                o.getStockedAt(),
                o.getCreatedAt(),
                o.getUpdatedAt());
    }
}
