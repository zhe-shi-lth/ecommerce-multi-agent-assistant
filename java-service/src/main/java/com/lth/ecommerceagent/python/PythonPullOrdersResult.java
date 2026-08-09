package com.lth.ecommerceagent.python;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 响应体，对应 Python 侧 PullOrdersResponse。
 *
 * <p>orders 为平台中立结构（字段与 orders 表一一对应，status 不在其中——状态由 Java 统一推导）；
 * warnings 记录某个平台取单失败的中文原因（如未对接、凭证缺失），由 Java 决定是否报错给用户。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PythonPullOrdersResult(
        @JsonProperty("orders") List<PlatformOrderPayload> orders,
        @JsonProperty("platforms") List<String> platforms,
        @JsonProperty("warnings") List<String> warnings) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlatformOrderPayload(
            @JsonProperty("platform") String platform,
            @JsonProperty("platform_order_id") String platformOrderId,
            @JsonProperty("order_date") String orderDate,
            @JsonProperty("quantity") Integer quantity,
            @JsonProperty("paid") Boolean paid,
            @JsonProperty("address_complete") Boolean addressComplete,
            @JsonProperty("manual_review_required") Boolean manualReviewRequired,
            @JsonProperty("payment") java.math.BigDecimal payment,
            @JsonProperty("post_fee") java.math.BigDecimal postFee,
            @JsonProperty("encrypted") Boolean encrypted,
            @JsonProperty("product_id") Long productId,
            @JsonProperty("plan_id") Long planId,
            @JsonProperty("platform_item_id") String platformItemId,
            @JsonProperty("receiver_name") String receiverName,
            @JsonProperty("receiver_phone") String receiverPhone,
            @JsonProperty("receiver_province") String receiverProvince,
            @JsonProperty("receiver_city") String receiverCity,
            @JsonProperty("receiver_district") String receiverDistrict,
            @JsonProperty("receiver_detail") String receiverDetail,
            @JsonProperty("buyer_nick") String buyerNick,
            @JsonProperty("logistics_company") String logisticsCompany,
            @JsonProperty("waybill_no") String waybillNo) {
    }
}
