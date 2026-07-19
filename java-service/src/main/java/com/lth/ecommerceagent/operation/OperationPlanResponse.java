package com.lth.ecommerceagent.operation;

import java.time.Instant;
import java.util.Map;

public record OperationPlanResponse(
        Long id,
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
        String confirmationStatus,
        Instant confirmedAt,
        Instant createdAt,
        Instant updatedAt,
        String line,
        Boolean auditPassed,
        String auditMessage) {
}
