package com.lth.ecommerceagent.user;

import java.time.Instant;

public record UserResponse(
        Long id,
        String email,
        String displayName,
        String role,
        String status,
        Instant createdAt,
        Instant lastLoginAt,
        java.util.List<Membership> memberships) {
    public record Membership(Long companyId, String companyName, String role, Long storeId, String storeName) {}
}
