package com.lth.ecommerceagent.order;

public record OrderCreateRequest(
        Long productId,
        String platform,
        // 平台侧订单号；新建时缺省会自动生成，更新时忽略（单号由来源决定，不允许改写）
        String platformOrderId,
        Integer quantity,
        String status,
        Boolean addressComplete,
        Boolean paid,
        Boolean manualReviewRequired,
        String fulfillmentSuggestionStatus,
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
        Boolean encrypted) {
}
