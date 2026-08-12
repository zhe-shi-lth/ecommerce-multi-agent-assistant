package com.lth.ecommerceagent.purchase;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PurchaseOrder p join fetch p.product left join fetch p.supplierRef where p.id = :id")
    Optional<PurchaseOrder> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findByStatus(String status);

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findByProductId(Long productId);

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findAll();

    boolean existsBySupplierRefId(Long supplierId);
}
