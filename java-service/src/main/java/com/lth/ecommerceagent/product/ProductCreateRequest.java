package com.lth.ecommerceagent.product;

import java.math.BigDecimal;

public record ProductCreateRequest(
        String name,
        String category,
        String description,
        BigDecimal costPrice,
        BigDecimal salePrice,
        String targetAudience,
        String usageScenario,
        String status) {
}
