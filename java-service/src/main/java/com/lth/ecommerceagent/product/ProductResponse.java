package com.lth.ecommerceagent.product;

import java.math.BigDecimal;
import java.time.Instant;

public record ProductResponse(
        Long id,
        String name,
        String category,
        String description,
        BigDecimal costPrice,
        BigDecimal salePrice,
        String targetAudience,
        String usageScenario,
        String status,
        Instant createdAt,
        Instant updatedAt) {
}
