package com.lth.ecommerceagent.aftersale;
import java.math.BigDecimal;
import java.time.Instant;
public record AfterSalesResponse(Long id, String afterSaleNo, Long orderId, String type, String status,
        Integer quantity, BigDecimal refundAmount, String reason, String returnDisposition,
        Instant refundedAt, Instant receivedAt, Instant completedAt, Instant createdAt, Instant updatedAt) {
    public static AfterSalesResponse from(AfterSalesOrder a){return new AfterSalesResponse(a.getId(),a.getAfterSaleNo(),a.getOrder().getId(),a.getType(),a.getStatus(),a.getQuantity(),a.getRefundAmount(),a.getReason(),a.getReturnDisposition(),a.getRefundedAt(),a.getReceivedAt(),a.getCompletedAt(),a.getCreatedAt(),a.getUpdatedAt());}
}
