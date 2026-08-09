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

    // 最近一次履约 Agent 重算的履约结论快照（JSONB；地址补全等场景回写）。
    @Column(name = "fulfillment_plan_json", columnDefinition = "JSONB")
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

    // 金额（对齐平台 payment / post_fee）
    @Column(name = "payment", nullable = false)
    private java.math.BigDecimal payment = java.math.BigDecimal.ZERO;

    @Column(name = "post_fee", nullable = false)
    private java.math.BigDecimal postFee = java.math.BigDecimal.ZERO;

    // 物流（已发货订单才有）
    @Column(name = "logistics_company", length = 60)
    private String logisticsCompany;

    @Column(name = "waybill_no", length = 60)
    private String waybillNo;

    // 平台是否对收件人信息加密（抖音密文电子面单 / 小红书加密收件人）
    @Column(name = "encrypted", nullable = false)
    private Boolean encrypted = false;

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
