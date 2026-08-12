package com.lth.ecommerceagent.inventory;

import java.time.Instant;

public record InventoryMovementResponse(
        Long id, Long productId, String movementType,
        Integer currentDelta, Integer reservedDelta,
        Integer currentAfter, Integer reservedAfter,
        String referenceType, Long referenceId, String reason,
        String operator, Instant createdAt) {
    public static InventoryMovementResponse from(InventoryMovement movement) {
        return new InventoryMovementResponse(
                movement.getId(), movement.getProduct().getId(), movement.getMovementType(),
                movement.getCurrentDelta(), movement.getReservedDelta(),
                movement.getCurrentAfter(), movement.getReservedAfter(),
                movement.getReferenceType(), movement.getReferenceId(), movement.getReason(),
                movement.getOperator(), movement.getCreatedAt());
    }
}
