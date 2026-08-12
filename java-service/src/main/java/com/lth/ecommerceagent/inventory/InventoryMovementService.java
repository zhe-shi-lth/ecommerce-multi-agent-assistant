package com.lth.ecommerceagent.inventory;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class InventoryMovementService {
    private final InventoryMovementRepository repository;
    private final InventoryRepository inventoryRepository;

    public InventoryMovementService(
            InventoryMovementRepository repository,
            InventoryRepository inventoryRepository) {
        this.repository = repository;
        this.inventoryRepository = inventoryRepository;
    }

    public void record(Long productId, String movementType, int currentDelta, int reservedDelta,
            String referenceType, Long referenceId, String reason) {
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new IllegalStateException("库存记录不存在：" + productId));
        InventoryMovement movement = new InventoryMovement();
        movement.setProduct(inventory.getProduct());
        movement.setMovementType(movementType);
        movement.setCurrentDelta(currentDelta);
        movement.setReservedDelta(reservedDelta);
        movement.setCurrentAfter(inventory.getCurrentStock());
        movement.setReservedAfter(inventory.getReservedStock());
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setReason(reason);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        movement.setOperator(auth != null && auth.isAuthenticated() ? auth.getName() : "SYSTEM");
        repository.save(movement);
    }
}
