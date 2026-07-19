package com.lth.ecommerceagent.order;

import java.time.Instant;

public record OrderResponse(
        Long id,
        Long productId,
        String platform,
        Integer quantity,
        String status,
        Boolean addressComplete,
        Boolean paid,
        Boolean manualReviewRequired,
        String fulfillmentSuggestionStatus,
        Instant createdAt,
        Instant updatedAt) {
}
