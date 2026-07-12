package com.lth.ecommerceagent.category;

import java.time.Instant;

public record CategoryResponse(Long id, String name, Instant createdAt) {
}
