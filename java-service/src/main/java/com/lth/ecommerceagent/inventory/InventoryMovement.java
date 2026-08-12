package com.lth.ecommerceagent.inventory;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

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

@Entity
@Table(name = "inventory_movements")
public class InventoryMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "movement_type", nullable = false, length = 40)
    private String movementType;
    @Column(name = "current_delta", nullable = false)
    private Integer currentDelta;
    @Column(name = "reserved_delta", nullable = false)
    private Integer reservedDelta;
    @Column(name = "current_after", nullable = false)
    private Integer currentAfter;
    @Column(name = "reserved_after", nullable = false)
    private Integer reservedAfter;
    @Column(name = "reference_type", length = 40)
    private String referenceType;
    @Column(name = "reference_id")
    private Long referenceId;
    @Column(nullable = false, length = 500)
    private String reason;
    @Column(nullable = false)
    private String operator;
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getMovementType() { return movementType; }
    public void setMovementType(String movementType) { this.movementType = movementType; }
    public Integer getCurrentDelta() { return currentDelta; }
    public void setCurrentDelta(Integer currentDelta) { this.currentDelta = currentDelta; }
    public Integer getReservedDelta() { return reservedDelta; }
    public void setReservedDelta(Integer reservedDelta) { this.reservedDelta = reservedDelta; }
    public Integer getCurrentAfter() { return currentAfter; }
    public void setCurrentAfter(Integer currentAfter) { this.currentAfter = currentAfter; }
    public Integer getReservedAfter() { return reservedAfter; }
    public void setReservedAfter(Integer reservedAfter) { this.reservedAfter = reservedAfter; }
    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }
    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public Instant getCreatedAt() { return createdAt; }
}
