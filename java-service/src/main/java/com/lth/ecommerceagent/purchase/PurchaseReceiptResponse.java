package com.lth.ecommerceagent.purchase;
import java.time.Instant;
public record PurchaseReceiptResponse(Long id, Long purchaseOrderId, String receiptNo, Integer quantity,
        String note, Instant receivedAt, String operator) {
    public static PurchaseReceiptResponse from(PurchaseReceipt r) {
        return new PurchaseReceiptResponse(r.getId(), r.getPurchaseOrder().getId(), r.getReceiptNo(),
                r.getQuantity(), r.getNote(), r.getReceivedAt(), r.getOperator());
    }
}
