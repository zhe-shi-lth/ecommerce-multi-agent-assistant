package com.lth.ecommerceagent.purchase;

import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "purchase_receipts")
public class PurchaseReceipt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "purchase_order_id") private PurchaseOrder purchaseOrder;
    @Column(name = "receipt_no", nullable = false, unique = true, length = 80) private String receiptNo;
    @Column(nullable = false) private Integer quantity;
    @Column(length = 500) private String note;
    @Column(name = "received_at", nullable = false) private Instant receivedAt;
    @Column(nullable = false) private String operator;
    public Long getId() { return id; }
    public PurchaseOrder getPurchaseOrder() { return purchaseOrder; }
    public void setPurchaseOrder(PurchaseOrder purchaseOrder) { this.purchaseOrder = purchaseOrder; }
    public String getReceiptNo() { return receiptNo; }
    public void setReceiptNo(String receiptNo) { this.receiptNo = receiptNo; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
