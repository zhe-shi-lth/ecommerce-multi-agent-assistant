package com.lth.ecommerceagent.supplier;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 进货商家档案（主数据）。
 *
 * <p>每个商品可关联一个主供应商（products.supplier_id）。补货建单时可自动带出商家与交期(lead_time_days)，
 * 并据此估算到货时间。settlement_type 仅作档案记录，不参与结算计算。
 */
@Entity
@Table(name = "suppliers")
public class Supplier {
    @Column(name="company_id",nullable=false) private Long companyId;

    public enum SettlementType {
        MONTHLY, // 月结
        CASH,    // 现结
        PREPAID  // 预付
    }

    public enum Status {
        ACTIVE,   // 合作中
        DISABLED  // 停用
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "contact_name", length = 60)
    private String contactName;

    @Column(name = "contact_phone", length = 40)
    private String contactPhone;

    @Column(length = 255)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "settlement_type", length = 20)
    private SettlementType settlementType = SettlementType.CASH;

    @Column(name = "lead_time_days", nullable = false)
    private Integer leadTimeDays = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    @Column(length = 500)
    private String remark;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }
    @jakarta.persistence.PrePersist void assignTenant(){if(companyId==null)companyId=com.lth.ecommerceagent.tenant.TenantContext.companyId();}
    public Long getCompanyId(){return companyId;}

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getContactName() {
        return contactName;
    }

    public void setContactName(String contactName) {
        this.contactName = contactName;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public SettlementType getSettlementType() {
        return settlementType;
    }

    public void setSettlementType(SettlementType settlementType) {
        this.settlementType = settlementType;
    }

    public Integer getLeadTimeDays() {
        return leadTimeDays;
    }

    public void setLeadTimeDays(Integer leadTimeDays) {
        this.leadTimeDays = leadTimeDays;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
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
