package com.lth.ecommerceagent.product;

import java.math.BigDecimal;

/**
 * 商品创建/更新请求。
 *
 * <p>用可变类而非 record，是为了区分「supplierId 未传（保留原值）」与「supplierId=null（清空商家）」：
 * Jackson 仅在 JSON 显式出现 supplierId 时才调用 setSupplierId，从而置位 supplierIdSet；
 * 未出现的字段不会置位，apply() 据此跳过供应商更新，避免编辑其它字段时误清空已绑定商家。
 */
public class ProductCreateRequest {

    private String name;
    private String category;
    private String description;
    private BigDecimal costPrice;
    private BigDecimal salePrice;
    private String targetAudience;
    private String usageScenario;
    private String status;
    private Long supplierId;
    private boolean supplierIdSet = false;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(BigDecimal costPrice) {
        this.costPrice = costPrice;
    }

    public BigDecimal getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
    }

    public String getTargetAudience() {
        return targetAudience;
    }

    public void setTargetAudience(String targetAudience) {
        this.targetAudience = targetAudience;
    }

    public String getUsageScenario() {
        return usageScenario;
    }

    public void setUsageScenario(String usageScenario) {
        this.usageScenario = usageScenario;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(Long supplierId) {
        this.supplierId = supplierId;
        this.supplierIdSet = true;
    }

    /** 仅当 JSON 显式出现 supplierId 时为真（含 null）。 */
    public boolean isSupplierIdSet() {
        return supplierIdSet;
    }
}
