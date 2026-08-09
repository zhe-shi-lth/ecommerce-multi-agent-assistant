package com.lth.ecommerceagent.purchase;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lth.ecommerceagent.order.RecheckAllResult;

/** 入库结果：本采购单 + 入库后触发的相关缺货订单重新判定统计。 */
public record StockInResult(
        @JsonProperty("purchase_order") PurchaseOrderResponse purchaseOrder,
        @JsonProperty("recheck") RecheckAllResult recheck) {
}
