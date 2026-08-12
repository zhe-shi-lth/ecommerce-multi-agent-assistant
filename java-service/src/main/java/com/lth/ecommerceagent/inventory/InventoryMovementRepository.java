package com.lth.ecommerceagent.inventory;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(Long productId);
    List<InventoryMovement> findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            String referenceType, Long referenceId);
}
