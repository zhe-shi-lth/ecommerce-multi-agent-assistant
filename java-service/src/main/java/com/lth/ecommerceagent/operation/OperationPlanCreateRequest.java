package com.lth.ecommerceagent.operation;

import java.util.Map;

public record OperationPlanCreateRequest(
        String traceId,
        Long productId,
        Long orderId,
        String platform,
        Map<String, Object> productPlanJson,
        Map<String, Object> imagePlanJson,
        Map<String, Object> inventoryPlanJson,
        Map<String, Object> fulfillmentPlanJson,
        String finalSummary,
        Boolean manualReviewRequired,
        String status,
        String line) {
}
