package com.lth.ecommerceagent.supplier;

/** 创建 / 更新进货商家档案的请求体（全部可选字段，便于部分更新）。 */
public record SupplierRequest(
        String name,
        String contactName,
        String contactPhone,
        String address,
        Supplier.SettlementType settlementType,
        Integer leadTimeDays,
        Supplier.Status status,
        String remark) {
}
