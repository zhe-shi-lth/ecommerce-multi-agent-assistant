package com.lth.ecommerceagent.purchase;

import java.math.BigDecimal;
import java.time.Instant;

import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.supplier.Supplier;
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
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 采购补货单（线2 库存处理工作台的核心实体）。
 *
 * <p>生命周期：PENDING_APPROVAL(待审批) → CREATED(待采购) → ORDERED(已下单) → INBOUND(待入库) → STOCKED(已入库)。
 * 商家发起采购申请时即生成采购单，审批通过后进入待采购；
 * 入库(STOCKED)时增加对应商品库存并触发该商品缺货订单的重新判定（见 PurchaseService.stockIn）。
 */
@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {
    @Column(name="company_id", nullable=false) private Long companyId;
    @Column(name="store_id", nullable=false) private Long storeId;
    @jakarta.persistence.PrePersist void assignTenant(){if(companyId==null)companyId=com.lth.ecommerceagent.tenant.TenantContext.companyId();if(storeId==null)storeId=com.lth.ecommerceagent.tenant.TenantContext.storeId();}
    public Long getCompanyId(){return companyId;} public Long getStoreId(){return storeId;}

    public static final String PENDING_APPROVAL = "PENDING_APPROVAL";
    public static final String REJECTED = "REJECTED";
    public static final String CREATED = "CREATED";
    public static final String ORDERED = "ORDERED";
    public static final String INBOUND = "INBOUND";
    public static final String PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED";
    public static final String STOCKED = "STOCKED";
    public static final String CANCELLED = "CANCELLED";
    public static final String CLOSED_SHORT = "CLOSED_SHORT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    // —— 成本核算字段（成本闭环，与订单发货运费严格区分）——
    @Column(name = "unit_cost", precision = 12, scale = 2)
    private BigDecimal unitCost;

    // 商品金额 = unit_cost * quantity
    @Column(name = "product_amount", precision = 14, scale = 2)
    private BigDecimal productAmount;

    // 进货运费：供应商发到卖家仓库的运费
    @Column(name = "purchase_shipping_fee", precision = 12, scale = 2)
    private BigDecimal purchaseShippingFee;

    // 总成本 = product_amount + purchase_shipping_fee
    @Column(name = "total_cost", precision = 14, scale = 2)
    private BigDecimal totalCost;

    // 单件综合成本 = total_cost / actual_quantity（入库后写回商品 cost_price）
    @Column(name = "landed_unit_cost", precision = 12, scale = 2)
    private BigDecimal landedUnitCost;

    // 预计到货时间
    @Column(name = "expected_arrival_at")
    private Instant expectedArrivalAt;

    // 实际入库数量（默认 = quantity；现实可能到货少于下单）
    @Column(name = "actual_quantity")
    private Integer actualQuantity;

    @Column(name = "received_quantity", nullable = false)
    private Integer receivedQuantity = 0;

    // 入库备注（破损 / 少发说明等）
    @Column(name = "inbound_note", length = 500)
    private String inboundNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "supplier_id")
    private Supplier supplierRef;

    // 商家名称快照（落库时写入，防止商家改名/删除后历史采购单信息错乱）。
    // 复用原 supplier 文本列，避免新增列与历史数据迁移。
    @Column(name = "supplier", length = 120)
    private String supplierName;

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

    public Long getVersion() { return version; }
    public Integer getReceivedQuantity() { return receivedQuantity; }
    public void setReceivedQuantity(Integer receivedQuantity) { this.receivedQuantity = receivedQuantity; }

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

    public BigDecimal getUnitCost() {
        return unitCost;
    }

    public void setUnitCost(BigDecimal unitCost) {
        this.unitCost = unitCost;
    }

    public BigDecimal getProductAmount() {
        return productAmount;
    }

    public void setProductAmount(BigDecimal productAmount) {
        this.productAmount = productAmount;
    }

    public BigDecimal getPurchaseShippingFee() {
        return purchaseShippingFee;
    }

    public void setPurchaseShippingFee(BigDecimal purchaseShippingFee) {
        this.purchaseShippingFee = purchaseShippingFee;
    }

    public BigDecimal getTotalCost() {
        return totalCost;
    }

    public void setTotalCost(BigDecimal totalCost) {
        this.totalCost = totalCost;
    }

    public BigDecimal getLandedUnitCost() {
        return landedUnitCost;
    }

    public void setLandedUnitCost(BigDecimal landedUnitCost) {
        this.landedUnitCost = landedUnitCost;
    }

    public Instant getExpectedArrivalAt() {
        return expectedArrivalAt;
    }

    public void setExpectedArrivalAt(Instant expectedArrivalAt) {
        this.expectedArrivalAt = expectedArrivalAt;
    }

    public Integer getActualQuantity() {
        return actualQuantity;
    }

    public void setActualQuantity(Integer actualQuantity) {
        this.actualQuantity = actualQuantity;
    }

    public String getInboundNote() {
        return inboundNote;
    }

    public void setInboundNote(String inboundNote) {
        this.inboundNote = inboundNote;
    }

    public Supplier getSupplierRef() {
        return supplierRef;
    }

    public void setSupplierRef(Supplier supplierRef) {
        this.supplierRef = supplierRef;
    }

    public String getSupplierName() {
        return supplierName;
    }

    public void setSupplierName(String supplierName) {
        this.supplierName = supplierName;
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
