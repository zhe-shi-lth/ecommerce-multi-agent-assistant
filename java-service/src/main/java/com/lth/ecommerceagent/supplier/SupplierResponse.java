package com.lth.ecommerceagent.supplier;

import java.time.Instant;

public record SupplierResponse(
        Long id,
        String name,
        String contactName,
        String contactPhone,
        String address,
        Supplier.SettlementType settlementType,
        Integer leadTimeDays,
        Supplier.Status status,
        String remark,
        Instant createdAt,
        Instant updatedAt) {

    public static SupplierResponse from(Supplier s) {
        return new SupplierResponse(
                s.getId(),
                s.getName(),
                s.getContactName(),
                s.getContactPhone(),
                s.getAddress(),
                s.getSettlementType(),
                s.getLeadTimeDays(),
                s.getStatus(),
                s.getRemark(),
                s.getCreatedAt(),
                s.getUpdatedAt());
    }
}
