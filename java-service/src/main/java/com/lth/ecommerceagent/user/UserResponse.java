package com.lth.ecommerceagent.user;

import java.time.Instant;

public record UserResponse(
        String email,
        String role,
        Instant createdAt,
        Instant lastLoginAt) {
}
