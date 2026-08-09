package com.lth.ecommerceagent.purchase;

import java.time.Instant;

import com.lth.ecommerceagent.product.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 采购补货单（线2 库存处理工作台的核心实体）。
 *
 * <p>生命周期：CREATED(待采购) → ORDERED(已下单) → INBOUND(待入库) → STOCKED(已入库)。
 * 「待确认补货建议」由销售监控的库存不足汇总派生（不落库），商家确认后生成 CREATED 采购单；
 * 入库(STOCKED)时增加对应商品库存并触发该商品缺货订单的重新判定（见 PurchaseService.stockIn）。
 */
@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {

    public static final String CREATED = "CREATED";
    public static final String ORDERED = "ORDERED";
    public static final String INBOUND = "INBOUND";
    public static final String STOCKED = "STOCKED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "supplier", length = 120)
    private String supplier;

    @Column(name = "status", nullable = false, length = 40)
    private String status;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "ordered_at")
    private Instant orderedAt;

    @Column(name = "inbound_at")
    private Instant inboundAt;

    @Column(name = "stocked_at")
    private Instant stockedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getSupplier() {
        return supplier;
    }

    public void setSupplier(String supplier) {
        this.supplier = supplier;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getOrderedAt() {
        return orderedAt;
    }

    public void setOrderedAt(Instant orderedAt) {
        this.orderedAt = orderedAt;
    }

    public Instant getInboundAt() {
        return inboundAt;
    }

    public void setInboundAt(Instant inboundAt) {
        this.inboundAt = inboundAt;
    }

    public Instant getStockedAt() {
        return stockedAt;
    }

    public void setStockedAt(Instant stockedAt) {
        this.stockedAt = stockedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
