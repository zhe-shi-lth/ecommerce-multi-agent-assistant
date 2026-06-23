package com.lth.ecommerceagent.order;

public record OrderCreateRequest(
        Long productId,
        Integer quantity,
        String status,
        Boolean addressComplete,
        Boolean paid,
        Boolean manualReviewRequired,
        String fulfillmentSuggestionStatus) {
}
