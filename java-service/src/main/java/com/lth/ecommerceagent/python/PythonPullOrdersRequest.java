package com.lth.ecommerceagent.python;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 请求体，对应 Python 侧 POST /agent/ecommerce/platform/pull-orders。
 *
 * <p>Java 只说"我要哪些商品、最近多少天"，平台凭证与协议细节全部在 Python 侧，
 * Java 不持有任何平台密钥。
 */
public record PythonPullOrdersRequest(
        @JsonProperty("plans") List<PlanTargetPayload> plans,
        @JsonProperty("since_days") int sinceDays) {

    public record PlanTargetPayload(
            @JsonProperty("platform") String platform,
            @JsonProperty("plan_id") Long planId,
            @JsonProperty("product_id") Long productId,
            @JsonProperty("product_name") String productName,
            @JsonProperty("platform_item_id") String platformItemId) {
    }
}
