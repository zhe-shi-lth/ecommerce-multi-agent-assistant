package com.lth.ecommerceagent.purchase;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findByStatus(String status);

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findByProductId(Long productId);

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findAll();

    boolean existsBySupplierRefId(Long supplierId);
}
