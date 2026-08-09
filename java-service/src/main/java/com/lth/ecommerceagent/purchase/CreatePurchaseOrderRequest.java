package com.lth.ecommerceagent.purchase;

/** 创建采购补货单（由「待确认补货建议」确认生成，初始态 CREATED=待采购）。 */
public record CreatePurchaseOrderRequest(
        Long productId,
        Integer quantity,
        String supplier,
        String note) {
}
