package com.lth.ecommerceagent.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "daily_sales", uniqueConstraints = @jakarta.persistence.UniqueConstraint(
        name = "uk_daily_sales_store_product_platform_date", columnNames = {"store_id", "product_id", "platform", "sale_date"}))
public class DailySales {
    @Column(name="company_id", nullable=false) private Long companyId;
    @Column(name="store_id", nullable=false) private Long storeId;
    @jakarta.persistence.PrePersist void assignTenant(){if(companyId==null)companyId=com.lth.ecommerceagent.tenant.TenantContext.companyId();if(storeId==null)storeId=com.lth.ecommerceagent.tenant.TenantContext.storeId();}
    public Long getCompanyId(){return companyId;} public Long getStoreId(){return storeId;}

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    // 销售来源平台：taobao / douyin / xiaohongshu；历史/未指定数据为 unspecified
    @Column(name = "platform", nullable = false, length = 20)
    private String platform = "unspecified";

    @Column(name = "sale_date", nullable = false)
    private LocalDate saleDate;

    @Column(name = "revenue", nullable = false)
    private BigDecimal revenue;

    @Column(name = "units", nullable = false)
    private Integer units;

    @Column(name = "order_count", nullable = false)
    private Integer orderCount;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public LocalDate getSaleDate() {
        return saleDate;
    }

    public void setSaleDate(LocalDate saleDate) {
        this.saleDate = saleDate;
    }

    public BigDecimal getRevenue() {
        return revenue;
    }

    public void setRevenue(BigDecimal revenue) {
        this.revenue = revenue;
    }

    public Integer getUnits() {
        return units;
    }

    public void setUnits(Integer units) {
        this.units = units;
    }

    public Integer getOrderCount() {
        return orderCount;
    }

    public void setOrderCount(Integer orderCount) {
        this.orderCount = orderCount;
    }
}
