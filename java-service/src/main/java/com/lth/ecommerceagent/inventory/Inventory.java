package com.lth.ecommerceagent.inventory;

import java.time.Instant;

import com.lth.ecommerceagent.product.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "inventories")
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, unique = true)
    private Product product;

    @Column(name = "current_stock", nullable = false)
    private Integer currentStock;

    @Column(name = "reserved_stock", nullable = false)
    private Integer reservedStock;

    @Column(name = "safe_stock_threshold", nullable = false)
    private Integer safeStockThreshold;

    @Column(name = "purchase_cycle_days", nullable = false)
    private Integer purchaseCycleDays;

    @Column(name = "sales_last_7_days", nullable = false)
    private Integer salesLast7Days;

    @Column(name = "inventory_status", nullable = false, length = 40)
    private String inventoryStatus;

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

    public Integer getCurrentStock() {
        return currentStock;
    }

    public void setCurrentStock(Integer currentStock) {
        this.currentStock = currentStock;
    }

    public Integer getReservedStock() {
        return reservedStock;
    }

    public void setReservedStock(Integer reservedStock) {
        this.reservedStock = reservedStock;
    }

    public Integer getSafeStockThreshold() {
        return safeStockThreshold;
    }

    public void setSafeStockThreshold(Integer safeStockThreshold) {
        this.safeStockThreshold = safeStockThreshold;
    }

    public Integer getPurchaseCycleDays() {
        return purchaseCycleDays;
    }

    public void setPurchaseCycleDays(Integer purchaseCycleDays) {
        this.purchaseCycleDays = purchaseCycleDays;
    }

    public Integer getSalesLast7Days() {
        return salesLast7Days;
    }

    public void setSalesLast7Days(Integer salesLast7Days) {
        this.salesLast7Days = salesLast7Days;
    }

    public String getInventoryStatus() {
        return inventoryStatus;
    }

    public void setInventoryStatus(String inventoryStatus) {
        this.inventoryStatus = inventoryStatus;
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
