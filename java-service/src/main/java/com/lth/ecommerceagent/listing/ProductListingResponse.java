package com.lth.ecommerceagent.listing;

import java.time.Instant;

public record ProductListingResponse(Long id, Long productId, Long operationPlanId, String platform,
        String status, String externalItemId, String externalUrl, String lastMessage,
        Instant publishedAt, Instant unpublishedAt, Instant createdAt, Instant updatedAt) {
    public static ProductListingResponse from(ProductListing l) {
        return new ProductListingResponse(l.getId(), l.getProduct().getId(),
                l.getOperationPlan() == null ? null : l.getOperationPlan().getId(), l.getPlatform(), l.getStatus(),
                l.getExternalItemId(), l.getExternalUrl(), l.getLastMessage(), l.getPublishedAt(),
                l.getUnpublishedAt(), l.getCreatedAt(), l.getUpdatedAt());
    }
}
