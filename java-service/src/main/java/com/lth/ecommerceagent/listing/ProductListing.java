package com.lth.ecommerceagent.listing;

import java.time.Instant;
import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.product.Product;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "product_listings", uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "platform"}))
public class ProductListing {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "product_id") private Product product;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "operation_plan_id") private OperationPlan operationPlan;
    @Column(nullable = false, length = 20) private String platform;
    @Column(nullable = false, length = 30) private String status;
    @Column(name = "external_item_id", length = 160) private String externalItemId;
    @Column(name = "external_url", columnDefinition = "text") private String externalUrl;
    @Column(name = "last_message", length = 1000) private String lastMessage;
    @Column(name = "published_at") private Instant publishedAt;
    @Column(name = "unpublished_at") private Instant unpublishedAt;
    @Version @Column(nullable = false) private Long version;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public OperationPlan getOperationPlan() { return operationPlan; }
    public void setOperationPlan(OperationPlan operationPlan) { this.operationPlan = operationPlan; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getExternalItemId() { return externalItemId; }
    public void setExternalItemId(String externalItemId) { this.externalItemId = externalItemId; }
    public String getExternalUrl() { return externalUrl; }
    public void setExternalUrl(String externalUrl) { this.externalUrl = externalUrl; }
    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public Instant getUnpublishedAt() { return unpublishedAt; }
    public void setUnpublishedAt(Instant unpublishedAt) { this.unpublishedAt = unpublishedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
