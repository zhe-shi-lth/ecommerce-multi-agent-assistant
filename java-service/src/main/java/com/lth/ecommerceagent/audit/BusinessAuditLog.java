package com.lth.ecommerceagent.audit;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "business_audit_logs")
public class BusinessAuditLog {
    @Column(name="company_id",nullable=false) private Long companyId;
    @Column(name="store_id",nullable=false) private Long storeId;
    @Column(name="user_id") private Long userId;
    @jakarta.persistence.PrePersist void assignTenant(){if(companyId==null)companyId=com.lth.ecommerceagent.tenant.TenantContext.companyId();if(storeId==null)storeId=com.lth.ecommerceagent.tenant.TenantContext.storeId();if(userId==null)userId=com.lth.ecommerceagent.tenant.TenantContext.userId();}
    public Long getCompanyId(){return companyId;} public Long getStoreId(){return storeId;} public Long getUserId(){return userId;}
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String domain;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(name = "before_status", length = 40)
    private String beforeStatus;

    @Column(name = "after_status", length = 40)
    private String afterStatus;

    @Column(nullable = false)
    private String operator;

    @Column(length = 1000)
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getBeforeStatus() { return beforeStatus; }
    public void setBeforeStatus(String beforeStatus) { this.beforeStatus = beforeStatus; }
    public String getAfterStatus() { return afterStatus; }
    public void setAfterStatus(String afterStatus) { this.afterStatus = afterStatus; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Instant getCreatedAt() { return createdAt; }
}
