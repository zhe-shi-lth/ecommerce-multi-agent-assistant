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
    @Query("select p from PurchaseOrder p join fetch p.product left join fetch p.supplierRef where p.id = :id and p.storeId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}")
    Optional<PurchaseOrder> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findByStatusAndStoreId(String status,Long storeId);
    default List<PurchaseOrder> findByStatus(String status){return findByStatusAndStoreId(status,com.lth.ecommerceagent.tenant.TenantContext.storeId());}

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findByProductIdAndStoreId(Long productId,Long storeId);
    default List<PurchaseOrder> findByProductId(Long id){return findByProductIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId());}

    @EntityGraph(attributePaths = {"product", "supplierRef"})
    List<PurchaseOrder> findAllByStoreId(Long storeId);
    @EntityGraph(attributePaths = {"product", "supplierRef"}) List<PurchaseOrder> findAllByCompanyId(Long companyId);
    @Override default List<PurchaseOrder> findAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}

    boolean existsBySupplierRefIdAndCompanyId(Long supplierId,Long companyId);
    default boolean existsBySupplierRefId(Long id){return existsBySupplierRefIdAndCompanyId(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
}
