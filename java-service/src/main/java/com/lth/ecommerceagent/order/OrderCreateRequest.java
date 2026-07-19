package com.lth.ecommerceagent.order;

public record OrderCreateRequest(
        Long productId,
        String platform,
        Integer quantity,
        String status,
        Boolean addressComplete,
        Boolean paid,
        Boolean manualReviewRequired,
        String fulfillmentSuggestionStatus) {
}
