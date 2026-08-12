package com.lth.ecommerceagent.operation;

import java.time.Instant;
import java.util.Map;

import com.lth.ecommerceagent.order.Order;
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
import jakarta.persistence.Version;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "operation_plans")
public class OperationPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "trace_id", nullable = false, length = 80, unique = true)
    private String traceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "order_id", nullable = true)
    private Order order;

    // 关联平台：taobao / douyin / xiaohongshu；历史/未指定数据为 unspecified
    @Column(name = "platform", nullable = false, length = 20)
    private String platform = "unspecified";

    // 业务线：LINE1_ONBOARDING=新品上架流水线；LINE2_MONITOR=每日监控（库存/履约）
    @Column(name = "line", length = 40)
    private String line;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "product_plan_json", nullable = false)
    private Map<String, Object> productPlanJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "image_plan_json", nullable = false)
    private Map<String, Object> imagePlanJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "inventory_plan_json", nullable = false)
    private Map<String, Object> inventoryPlanJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fulfillment_plan_json", nullable = false)
    private Map<String, Object> fulfillmentPlanJson;

    @Column(name = "final_summary", nullable = false, columnDefinition = "text")
    private String finalSummary;

    @Column(name = "manual_review_required", nullable = false)
    private Boolean manualReviewRequired;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "confirmation_status", nullable = false, length = 40)
    private String confirmationStatus = "PENDING";

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public Long getVersion() { return version; }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getLine() {
        return line;
    }

    public void setLine(String line) {
        this.line = line;
    }

    public Map<String, Object> getProductPlanJson() {
        return productPlanJson;
    }

    public void setProductPlanJson(Map<String, Object> productPlanJson) {
        this.productPlanJson = productPlanJson;
    }

    public Map<String, Object> getImagePlanJson() {
        return imagePlanJson;
    }

    public void setImagePlanJson(Map<String, Object> imagePlanJson) {
        this.imagePlanJson = imagePlanJson;
    }

    public Map<String, Object> getInventoryPlanJson() {
        return inventoryPlanJson;
    }

    public void setInventoryPlanJson(Map<String, Object> inventoryPlanJson) {
        this.inventoryPlanJson = inventoryPlanJson;
    }

    public Map<String, Object> getFulfillmentPlanJson() {
        return fulfillmentPlanJson;
    }

    public void setFulfillmentPlanJson(Map<String, Object> fulfillmentPlanJson) {
        this.fulfillmentPlanJson = fulfillmentPlanJson;
    }

    public String getFinalSummary() {
        return finalSummary;
    }

    public void setFinalSummary(String finalSummary) {
        this.finalSummary = finalSummary;
    }

    public Boolean getManualReviewRequired() {
        return manualReviewRequired;
    }

    public void setManualReviewRequired(Boolean manualReviewRequired) {
        this.manualReviewRequired = manualReviewRequired;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getConfirmationStatus() {
        return confirmationStatus;
    }

    public void setConfirmationStatus(String confirmationStatus) {
        this.confirmationStatus = confirmationStatus;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(Instant confirmedAt) {
        this.confirmedAt = confirmedAt;
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
