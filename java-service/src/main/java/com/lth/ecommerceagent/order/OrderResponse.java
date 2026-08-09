package com.lth.ecommerceagent.order;

import java.time.Instant;
import java.util.Map;

public record OrderResponse(
        Long id,
        Long productId,
        String platform,
        // 平台侧订单号：商家可拿它到平台后台核对同一笔订单
        String platformOrderId,
        Integer quantity,
        String status,
        Boolean addressComplete,
        Boolean paid,
        Boolean manualReviewRequired,
        String fulfillmentSuggestionStatus,
        String pendingReason,
        Map<String, Object> fulfillmentPlanJson,
        String receiverName,
        String receiverPhone,
        String receiverProvince,
        String receiverCity,
        String receiverDistrict,
        String receiverDetail,
        String buyerNick,
        java.math.BigDecimal payment,
        java.math.BigDecimal postFee,
        String logisticsCompany,
        String waybillNo,
        Boolean encrypted,
        Instant shippedAt,
        Instant createdAt,
        Instant updatedAt) {
}
