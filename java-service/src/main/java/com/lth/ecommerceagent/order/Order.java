package com.lth.ecommerceagent.order;

import java.time.Instant;
import java.util.Map;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // 订单来源平台：taobao / douyin / xiaohongshu；历史/未指定数据为 unspecified
    @Column(name = "platform", nullable = false, length = 20)
    private String platform = "unspecified";

    // 平台侧订单号（商家在平台后台看到的那个号）。模拟数据同样有值（MOCK 前缀），
    // 与 platform 组成唯一键，真实拉单重复同步时用于幂等去重。
    @Column(name = "platform_order_id", nullable = false, length = 64)
    private String platformOrderId;

    // 数据来源：mock=本地模拟造数；real=平台开放 API 拉取。
    @Column(name = "source", nullable = false, length = 10)
    private String source = "mock";

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "address_complete", nullable = false)
    private Boolean addressComplete;

    @Column(nullable = false)
    private Boolean paid;

    @Column(name = "manual_review_required", nullable = false)
    private Boolean manualReviewRequired;

    @Column(name = "fulfillment_suggestion_status", nullable = false, length = 40)
    private String fulfillmentSuggestionStatus;

    // 待处理原因（仅 status=PENDING_ANALYSIS 时有意义；离开待分析后保留用于追溯）：
    // UNPAID=仅未付款 / ADDRESS_INCOMPLETE=仅地址不全 / UNPAID_AND_ADDRESS=两者都有。
    // 用于前端按原因归类、精准展示对应话术（催付 / 催补全地址），以及超时升级后区分来源。
    @Column(name = "pending_reason", length = 30)
    private String pendingReason;

    // 最近一次履约 Agent 重算的履约结论快照（JSONB；地址补全等场景回写）。
    // 用 @JdbcTypeCode(SqlTypes.JSON) 而非 columnDefinition="JSONB"，保证多库可移植：
    // PostgreSQL 下映射 jsonb（与 Flyway 迁移一致），H2 测试库下映射 json。
    @Column(name = "fulfillment_plan_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> fulfillmentPlanJson;

    // 收件人信息（对齐平台订单 API 的 receiver_* 字段）
    @Column(name = "receiver_name", length = 60)
    private String receiverName;

    @Column(name = "receiver_phone", length = 40)
    private String receiverPhone;

    @Column(name = "receiver_province", length = 40)
    private String receiverProvince;

    @Column(name = "receiver_city", length = 40)
    private String receiverCity;

    @Column(name = "receiver_district", length = 40)
    private String receiverDistrict;

    @Column(name = "receiver_detail", columnDefinition = "TEXT")
    private String receiverDetail;

    // 买家标识：淘宝 buyer_nick（花名）；抖音/小红书 为平台加密的匿名标识
    @Column(name = "buyer_nick", length = 80)
    private String buyerNick;

    // ===== 金额口径契约（接真实平台 API 前必须统一，见 grossProfit 计算处）=====
    // payment      = 买家总支付金额（含邮费），即 buyerPaidAmount。毛利公式以此为准。
    // postFee      = 买家支付的邮费（buyerShippingFee），仅用于展示/对账，不计入毛利（已含在 payment 中）。
    //               若某平台把 payment 拆成「商品实付 + 邮费」两份返回，则毛利公式需改为
    //               payment + postFee - 商品成本 - 发货运费；接平台时在此统一，不要各自假设。
    // shippingFee  = 商家实际支付的发货运费（sellerShippingFee），毛利扣减项；与采购单进货运费严格区分。

    // 金额（对齐平台 payment / post_fee）
    @Column(name = "payment", nullable = false)
    private java.math.BigDecimal payment = java.math.BigDecimal.ZERO;

    @Column(name = "post_fee", nullable = false)
    private java.math.BigDecimal postFee = java.math.BigDecimal.ZERO;

    // 发货运费（卖家 -> 买家 的实际运费，发货时必填手填；与采购单进货运费严格区分）
    @Column(name = "shipping_fee", precision = 12, scale = 2)
    private java.math.BigDecimal shippingFee;

    // 发货运费来源：MANUAL(手填) / TEMPLATE(模板预估，后续扩展)
    @Column(name = "shipping_fee_type", length = 20)
    private String shippingFeeType;

    // 成本/毛利快照（发货成功时写入，避免后续商品成本价变动导致历史利润漂移）
    @Column(name = "cost_price_snapshot", precision = 12, scale = 2)
    private java.math.BigDecimal costPriceSnapshot;

    @Column(name = "goods_cost_snapshot", precision = 14, scale = 2)
    private java.math.BigDecimal goodsCostSnapshot;

    @Column(name = "gross_profit", precision = 14, scale = 2)
    private java.math.BigDecimal grossProfit;

    // 物流（已发货订单才有）
    @Column(name = "logistics_company", length = 60)
    private String logisticsCompany;

    @Column(name = "waybill_no", length = 60)
    private String waybillNo;

    // 平台是否对收件人信息加密（抖音密文电子面单 / 小红书加密收件人）
    @Column(name = "encrypted", nullable = false)
    private Boolean encrypted = false;

    // 发货时间（仅 status=SHIPPED 有值）；发货闭环的终态标记。
    @Column(name = "shipped_at")
    private Instant shippedAt;

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

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getPlatformOrderId() {
        return platformOrderId;
    }

    public void setPlatformOrderId(String platformOrderId) {
        this.platformOrderId = platformOrderId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Boolean getAddressComplete() {
        return addressComplete;
    }

    public void setAddressComplete(Boolean addressComplete) {
        this.addressComplete = addressComplete;
    }

    public Boolean getPaid() {
        return paid;
    }

    public void setPaid(Boolean paid) {
        this.paid = paid;
    }

    public Boolean getManualReviewRequired() {
        return manualReviewRequired;
    }

    public void setManualReviewRequired(Boolean manualReviewRequired) {
        this.manualReviewRequired = manualReviewRequired;
    }

    public String getFulfillmentSuggestionStatus() {
        return fulfillmentSuggestionStatus;
    }

    public void setFulfillmentSuggestionStatus(String fulfillmentSuggestionStatus) {
        this.fulfillmentSuggestionStatus = fulfillmentSuggestionStatus;
    }

    public String getPendingReason() {
        return pendingReason;
    }

    public void setPendingReason(String pendingReason) {
        this.pendingReason = pendingReason;
    }

    /**
     * 由「付款 / 地址完整 / 状态」推导待处理原因枚举。
     * 仅当 status=PENDING_ANALYSIS 才有意义；其余状态返回 null（不是待处理）。
     */
    public static String computePendingReason(Boolean paid, Boolean addressComplete, String status) {
        if (!"PENDING_ANALYSIS".equals(status)) {
            return null;
        }
        boolean unpaid = Boolean.FALSE.equals(paid);
        boolean addrIncomplete = Boolean.FALSE.equals(addressComplete);
        if (unpaid && addrIncomplete) {
            return "UNPAID_AND_ADDRESS";
        }
        if (unpaid) {
            return "UNPAID";
        }
        if (addrIncomplete) {
            return "ADDRESS_INCOMPLETE";
        }
        return null;
    }

    public Map<String, Object> getFulfillmentPlanJson() {
        return fulfillmentPlanJson;
    }

    public void setFulfillmentPlanJson(Map<String, Object> fulfillmentPlanJson) {
        this.fulfillmentPlanJson = fulfillmentPlanJson;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverPhone() {
        return receiverPhone;
    }

    public void setReceiverPhone(String receiverPhone) {
        this.receiverPhone = receiverPhone;
    }

    public String getReceiverProvince() {
        return receiverProvince;
    }

    public void setReceiverProvince(String receiverProvince) {
        this.receiverProvince = receiverProvince;
    }

    public String getReceiverCity() {
        return receiverCity;
    }

    public void setReceiverCity(String receiverCity) {
        this.receiverCity = receiverCity;
    }

    public String getReceiverDistrict() {
        return receiverDistrict;
    }

    public void setReceiverDistrict(String receiverDistrict) {
        this.receiverDistrict = receiverDistrict;
    }

    public String getReceiverDetail() {
        return receiverDetail;
    }

    public void setReceiverDetail(String receiverDetail) {
        this.receiverDetail = receiverDetail;
    }

    public String getBuyerNick() {
        return buyerNick;
    }

    public void setBuyerNick(String buyerNick) {
        this.buyerNick = buyerNick;
    }

    public java.math.BigDecimal getPayment() {
        return payment;
    }

    public void setPayment(java.math.BigDecimal payment) {
        this.payment = payment;
    }

    public java.math.BigDecimal getPostFee() {
        return postFee;
    }

    public void setPostFee(java.math.BigDecimal postFee) {
        this.postFee = postFee;
    }

    public java.math.BigDecimal getShippingFee() {
        return shippingFee;
    }

    public void setShippingFee(java.math.BigDecimal shippingFee) {
        this.shippingFee = shippingFee;
    }

    public String getShippingFeeType() {
        return shippingFeeType;
    }

    public void setShippingFeeType(String shippingFeeType) {
        this.shippingFeeType = shippingFeeType;
    }

    public java.math.BigDecimal getCostPriceSnapshot() {
        return costPriceSnapshot;
    }

    public void setCostPriceSnapshot(java.math.BigDecimal costPriceSnapshot) {
        this.costPriceSnapshot = costPriceSnapshot;
    }

    public java.math.BigDecimal getGoodsCostSnapshot() {
        return goodsCostSnapshot;
    }

    public void setGoodsCostSnapshot(java.math.BigDecimal goodsCostSnapshot) {
        this.goodsCostSnapshot = goodsCostSnapshot;
    }

    public java.math.BigDecimal getGrossProfit() {
        return grossProfit;
    }

    public void setGrossProfit(java.math.BigDecimal grossProfit) {
        this.grossProfit = grossProfit;
    }

    public String getLogisticsCompany() {
        return logisticsCompany;
    }

    public void setLogisticsCompany(String logisticsCompany) {
        this.logisticsCompany = logisticsCompany;
    }

    public String getWaybillNo() {
        return waybillNo;
    }

    public void setWaybillNo(String waybillNo) {
        this.waybillNo = waybillNo;
    }

    public Boolean getEncrypted() {
        return encrypted;
    }

    public void setEncrypted(Boolean encrypted) {
        this.encrypted = encrypted;
    }

    public Instant getShippedAt() {
        return shippedAt;
    }

    public void setShippedAt(Instant shippedAt) {
        this.shippedAt = shippedAt;
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
