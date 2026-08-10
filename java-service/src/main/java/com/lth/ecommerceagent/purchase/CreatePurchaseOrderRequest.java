package com.lth.ecommerceagent.purchase;

import java.math.BigDecimal;
import java.time.Instant;

/** 创建采购补货单（由「待确认补货建议」确认生成，初始态 CREATED=待采购）。 */
public record CreatePurchaseOrderRequest(
        Long productId,
        Integer quantity,
        Long supplierId,
        // 进货单价（供应商 -> 卖家仓库）
        BigDecimal unitCost,
        // 进货运费
        BigDecimal purchaseShippingFee,
        // 预计到货时间（前端日期选择，可空）
        Instant expectedArrivalAt,
        String note) {
}
