package com.lth.ecommerceagent.inventory;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    List<InventoryMovement> findByProductIdAndStoreIdOrderByCreatedAtDesc(Long productId,Long storeId);
    List<InventoryMovement> findByProductIdAndCompanyIdOrderByCreatedAtDesc(Long productId,Long companyId);
    default List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(Long productId){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByProductIdAndStoreIdOrderByCreatedAtDesc(productId,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByProductIdAndCompanyIdOrderByCreatedAtDesc(productId,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    List<InventoryMovement> findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
            String referenceType, Long referenceId);
}
