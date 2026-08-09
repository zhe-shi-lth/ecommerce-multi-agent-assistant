package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lth.ecommerceagent.order.Order;

/**
 * 请求体，对应 Python 侧 OrderMonitorAgent.verify 的入参（订单上下文）。
 * 字段名使用 snake_case 以匹配 FastAPI 的 Pydantic 模型。
 *
 * <p>比履约重算的 OrderContext 多带 platform / platform_order_id：真实复核模式下，
 * Python 需要据此选对平台适配器、并用平台单号去平台侧查地址是否真已补全。
 */
public record PythonOrderVerifyRequest(@JsonProperty("order") OrderContext order) {

    public record OrderContext(
            @JsonProperty("order_id") Long orderId,
            @JsonProperty("product_id") Long productId,
            @JsonProperty("platform") String platform,
            @JsonProperty("platform_order_id") String platformOrderId,
            @JsonProperty("quantity") Integer quantity,
            @JsonProperty("status") String status,
            @JsonProperty("address_complete") Boolean addressComplete,
            @JsonProperty("paid") Boolean paid,
            @JsonProperty("manual_review_required") Boolean manualReviewRequired,
            @JsonProperty("fulfillment_suggestion_status") String fulfillmentSuggestionStatus) {
    }

    public static PythonOrderVerifyRequest from(Order order) {
        return new PythonOrderVerifyRequest(new OrderContext(
                order.getId(),
                order.getProduct().getId(),
                order.getPlatform(),
                order.getPlatformOrderId(),
                order.getQuantity(),
                order.getStatus(),
                order.getAddressComplete(),
                order.getPaid(),
                order.getManualReviewRequired(),
                order.getFulfillmentSuggestionStatus()));
    }
}
