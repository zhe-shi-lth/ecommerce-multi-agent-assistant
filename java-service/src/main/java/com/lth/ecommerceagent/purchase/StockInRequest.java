package com.lth.ecommerceagent.purchase;

/**
 * 确认入库入参：支持「买 100 件、到 98 件」的真实到货场景。
 * actualQuantity 为实际入库数量（缺省或 <=0 时回退到采购数量）；note 记录破损/少发说明。
 */
public record StockInRequest(
        Integer actualQuantity,
        String note) {
}
