package com.lth.ecommerceagent.operation;

import java.time.Instant;
import java.util.Map;

public record OperationPlanResponse(
        Long id,
        String traceId,
        Long productId,
        Long orderId,
        Map<String, Object> productPlanJson,
        Map<String, Object> imagePlanJson,
        Map<String, Object> inventoryPlanJson,
        Map<String, Object> fulfillmentPlanJson,
        String finalSummary,
        Boolean manualReviewRequired,
        String status,
        Instant createdAt,
        Instant updatedAt) {
}
